# Stage B: 파생 의미 레이어 shadow mode 1차 실행

실행일: 2026-09-03

적용 대상: `docs/derived_semantic_layer.md` §10 단계 B — "의미 오버레이로 answer plan을 만들되 사용자 응답에는 아직 적용하지 않는다."

## 1. 무엇을 연결했는가

- `engine/semantic_overlay_store.js`: 서버 기동 시 `data/derived/semantic/*.json`(Stage A 구조 오버레이)을 읽고, `validation/validate_semantic_overlay.js`와 동일한 canonical-hash 방식으로 각 문서의 `source_bundle_sha256`을 현재 코어 bundle과 대조한다. 불일치하면 해당 문서는 로드하지 않는다(`staleDocumentIds`) — 오버레이가 없을 때와 구분되지 않게, 항상 안전하게 코어 검색으로 fallback한다.
- `engine/semantic_shadow.js`: 실제로 만들어진 답변 envelope(route/mode/answer_intent/scope/coverage/claims)을 입력받아, 해당 문서(들)에 오버레이가 있으면 facet-level 새 plan을 계산한다. envelope는 절대 변경하지 않는다.
- `engine/semantic_shadow_log.js` + `engine/server.js`: `/api/ask`가 실제 응답을 만든 **뒤에** 새 plan을 계산해 `logs/runtime/semantic_shadow.jsonl`에 한 줄씩 append한다. 계산이 실패해도 `try/catch`로 흡수해 사용자 응답에는 영향을 주지 않는다(`engine/server.js`의 `/api/ask` 핸들러).
- `scripts/run_semantic_shadow_audit.js`: 이미 확보된 50문항 감사 결과(`logs/runtime/answer_suitability_50_raw_2026-09-03_final.json`, `history/verification/answer_suitability_audit_2026-09-02.md`)를 재실행 없이 그대로 재생해 `comparePlans()`에 통과시킨다. LLM 재호출이 없어 결정적이고 반복 가능하다.

## 2. facet coverage 계산 방식

각 facet는 두 가지 신호로 판정한다(`engine/semantic_shadow.js`의 `facetCoverage`):

- **exact**: facet의 `member_record_ids`가 실제 답변의 claim record id와 정확히 겹치는가.
- **topical**(exact가 0일 때만 보조 신호로 사용): 실제 claim 중 하나라도 facet의 `scope`(section)와 같거나 조상/자손 관계인 section에서 나왔는가.

exact가 전부 맞으면 `covered`, 일부만 맞으면 `partial`, exact가 0인데 topical만 참이면 `partial`(+`topical_only:true`), 아무 신호도 없으면 `missing`이다. Stage A 표본의 `member_record_ids`가 facet마다 대표 레코드 1개뿐이라(설계상 facet는 좁고 근거가 확인된 것만 생성 — §4.3) exact만 쓰면 실제로는 그 section을 답변이 다뤘어도 "missing"으로 과소평가되는 사례가 나와(§4의 Q14), topical 보조 신호를 추가했다. 이 조정은 설계 문서에 없던 구현 결정이며, `engine/semantic_shadow.js`에 근거와 함께 주석으로 남겨 두었다.

manifest 자체는 라우터의 `answer_intent`가 manifest의 `answer_intent`와 일치하지 않아도 후보에서 제외하지 않는다(`intent_match` 필드로만 표시). 대신 manifest의 대상 facet들의 `scope`(section)가 실제 resolved `section_ids`와 무관하면 제외한다(`isManifestRelevant`) — 문서 전체(target.type=document) manifest는 항상 후보로 남긴다. 이는 §6번 아래 Q26 사례를 숨기지 않기 위한 의도적 선택이다.

## 3. 50문항 재생 결과

| 항목 | 값 |
|---|---:|
| 재생한 문항 | 50 |
| applicable (문서에 매칭되는 오버레이가 있음) | 21 |
| not applicable — 문서에 오버레이가 아예 없음 | 2 |
| not applicable — 오버레이는 있으나 관련 manifest/축이 없음 | 27 |
| manifest status: complete | 0 |
| manifest status: partial | 14 |
| manifest status: ambiguous | 2 |
| manifest status: unavailable | 4 |

Stage A가 5개 문서 중 4개 대표 범위(ema_fih 문서개요, ich_m10 run acceptance 분기, fda_ada 5단계 밸리데이션, ich_m3_r2/ich_s6_r1 비교축)만 구조화했으므로 29/50는 애초에 대상 밖이다(대부분 not_applicable). 이는 결함이 아니라 표본 범위의 정직한 반영이다.

## 4. 구체적으로 확인된 사례

### Q06 — 감사에서 부적합으로 판정된 사례가 shadow에서도 독립적으로 잡힌다

Q06("분석 run을 accept하려면 calibration standard랑 QC가 각각 어떻게 돼야 해?")은 기술(chromatography/LBA)을 명시하지 않았다. 사람 감사(`answer_suitability_audit_2026-09-02.md`)의 판정: "부적합 — chromatography와 LBA가 섞이고 QC 2/3·각 수준 50% acceptance가 잘린다."

shadow plan은 같은 문제를 독립적으로, 수치로 재현한다:

```
manifest ich_m10.sem.manifest.run_acceptance: status = ambiguous
  chromatography_branch: partial (4/6 근거만 회수)
  lba_branch: partial (1/6 근거만 회수)
```

두 분기 모두 `applicability: ambiguous`이므로(질문에 기술이 없어 `target_assay` slot이 비어 있음) `on_ambiguity: present_branches` 설계 규칙대로면 두 분기를 모두 온전히 보여줘야 하는데, 실제 답변은 어느 쪽도 완결하지 못한 채 섞여 있다는 것이 정량적으로 드러난다.

### Q26 — 라우터의 intent 축소가 `intent_match:false`로 드러난다

Q26("EMA FIH 가이드라인은 첫 투여 전에 뭘 종합해서 보라는 거야?")은 문서 전체를 묻는 질문이지만 실제 라우터는 `answer_intent: topic_overview`로 분류했고 `resolved section_ids`가 §7.1/§7.2(dosing selection)로 좁혀졌다 — 사람 감사의 판정("EMA FIH 전체 개요를 dose-selection 절로 축소")과 정확히 같은 현상이다.

ema_fih의 `document_overview` manifest는 `target.type=document`라 항상 후보에 남으므로 이 축소가 숨겨지지 않는다:

```
manifest ema_fih.sem.manifest.document_overview: intent_match = false, status = partial
  scope: missing, quality: missing, non_clinical: missing,
  dose_selection: covered, trial_planning: missing
```

5개 최상위 facet 중 1개만 덮였다는 사실이 그대로 로그에 남는다. `intent_match:false`가 곧 결함을 의미하지는 않지만(narrow 질문에 document-level manifest가 항상 붙기 때문), 이 경우처럼 원래 질문 자체가 document-wide인데도 라우터가 topic_overview로 좁힌 사례를 사람이 로그에서 걸러낼 수 있는 신호가 된다.

### Q14 — topical 보조 신호가 과소평가를 바로잡은 사례

Q14는 사람 감사에서 "적합"(FDA ADA §VI.A~E 5개 절 모두 표시)로 판정됐다. exact-only 신호로는 5개 facet이 전부 `missing`으로 나왔다(라우터가 각 절에서 우리가 표본으로 고른 것과 다른 대표 레코드를 인용했기 때문). topical 신호를 추가한 뒤에는 5개 모두 `partial`(`topical_only:true`)로, 즉 "해당 절이 답변에 실제로 등장했다"는 사실이 정확히 반영된다. 이 조정이 없었다면 Stage B 로그가 Q14를 거짓으로 결함처럼 보고할 뻔했다 — 표본 크기가 작을 때 exact-only 신호가 얼마나 취약한지 보여주는 사례로 기록해 둔다.

### Q49/Q50 — 비교 축이 `scope`가 비어 있는 경로에서도 살아난다

`comparison_engine.js`의 comparison 경로는 envelope의 `scope`/`coverage`를 채우지 않는다(`answer_intent: null`, `scope: null`). `engine/semantic_shadow.js`는 claim의 `record.document_id`로 문서를 먼저 추정하므로 이 경로에서도 `scope.product_or_matrix` 공통 축이 정상적으로 잡힌다(Q49: ich_m3_r2/ich_s6_r1, Q50: ema_fih/ich_s6_r1).

## 5. Stage B 종료 판단 — §10 "새 레이어가 근거 recall을 줄이거나 범위를 과도하게 확장하면 해당 manifest를 needs_review로 되돌린다"

Stage A/B는 순수하게 읽기 전용·부가적이므로 이번 실행으로 어떤 manifest도 실제 근거 recall을 줄이지 않았다(현재 답변에는 전혀 반영되지 않음). 따라서 "되돌릴" 대상은 없다 — 애초에 모든 manifest가 아직 `needs_review`다. 대신 이번 실행은 Stage C 승격 검토 후보 우선순위를 준다:

- `ich_m10.sem.manifest.run_acceptance`: Q06의 실제 결함을 정량적으로 재현했고 `on_ambiguity=present_branches` 규칙이 정확히 이 상황을 위해 설계된 것임을 확인했다 — 승격 검토 1순위.
- `ema_fih.sem.manifest.document_overview`: Q26/Q50에서 반복적으로 narrow 답변의 coverage 결손을 드러냈다 — 승격 검토 2순위.
- `ich_m3_r2`/`ich_s6_r1`의 `scope.product_or_matrix` comparison binding: envelope.scope가 비어도 안정적으로 동작함을 확인했다 — 승격 검토 후보.
- `fda_ada.sem.manifest.assay_validation`: exact 신호만으로는 오탐(false negative)을 만들 뻔했다는 것이 이번 실행에서 드러난 유일한 유보 사항이다. Stage C로 승격하기 전에 각 facet의 `member_record_ids`를 대표 1개에서 해당 section의 실제 근거 집합으로 넓히는 편이 안전하다.

## 6. 알려진 한계 (1차 실행 시점)

- `isManifestRelevant`의 section 관련성 판정은 정확히 같은 section이거나 조상/자손 section일 때만 "관련"으로 본다 — 남매(sibling) section 관계는 잡지 못한다.
- `facetCoverage`의 topical 신호는 "같은 section에서 뭔가 인용됐다"까지만 확인하고 "그 section의 어떤 하위 주제가 인용됐는지"는 구분하지 않는다 — facet당 대표 근거가 여러 개로 늘어나면 다시 exact 신호 위주로 좁힐 수 있다.
- 아직 실행 엔진이 이 plan을 답변 조립에 사용하지 않는다(Stage C 이전). 이 문서는 shadow 로그를 사람이 읽고 판단하기 위한 요약이다.

이 다섯 항목(§7에서 다섯 번째까지 나열) 모두 특정 문항의 결과를 손으로 맞추는 patch가 아니라 `engine/semantic_shadow.js`/`engine/semantic_overlay_store.js`의 알고리즘 자체를 고치는 구조적 수정으로 처리했다 — 아래 §7.

## 7. 구조적 개선 (같은 날 반영, 재실행 완료)

1차 실행에서 나온 다섯 가지 한계를 전부 알고리즘 수준에서 고쳤다. 특정 질문을 통과시키기 위한 예외 처리가 아니라, 앞으로 만들 모든 facet/manifest/comparison_binding에 똑같이 적용되는 일반 규칙으로 구현했다.

### 7.1 `facetCoverage` — 대표 근거 1개 의존 제거 (구조 문제 #2, 가장 근본적)

기존에는 facet의 `member_record_ids`(대표 근거 1개)와 정확히 일치하는지만 봤다. 이제 `engine/semantic_overlay_store.js`가 서버 기동 시 코어 아카이브 전체를 section별로 색인(`sectionIndex.recordIdsBySectionId`, `childrenBySectionId`)해 두고, `engine/semantic_shadow.js`의 `expectedRecordIdsForFacet`가 facet의 `scope`와 그 하위 section 전체에 속한 실제 레코드 집합("section census")을 계산한다. `facetCoverage`는 이제 두 신호를 각각 보고한다:

- `exact`: 사람이 고른 대표 근거와의 정확 일치(정밀 신호)
- `section`: facet scope 전체 section census 대비 실제 인용 수(재현율 신호)

`status`는 `exact`를 우선하고, `exact`가 0일 때만 `section.covered > 0`으로 `partial`로 완화한다 — 이전의 boolean `topical_only` 플래그를 정량적인 `{covered, total}`로 교체했다. facet.scope가 문서 전체인 순수 그룹핑 facet(예: `ich_m10.sem.facet.run_acceptance` 부모)은 여전히 `not_applicable`로 남는다(자기 자신의 근거가 없는 추상화이므로).

### 7.2 `sectionsAreRelated` — 남매(sibling) section 인식 (구조 문제 #1)

manifest가 이 질문에 "관련 있는지" 판정하는 `isManifestRelevant`에서만 쓰는 함수에 같은 부모를 공유하는 남매 section 판정을 추가했다(조상/자손 판정에 no-hit일 때만 부모 비교). 임의 깊이의 공통 조상까지 허용하면 "같은 문서"로 퇴화하므로 의도적으로 직계 남매까지만 허용한다. `facetCoverage`의 section census(§7.1)는 이 완화된 관련성 판정을 쓰지 않는다 — 남매 section의 레코드를 커버리지 분모에 섞으면 그 facet이 실제로 다루는 내용보다 헐거운 기준이 되기 때문에, census는 여전히 엄격하게 scope의 직계 하위 트리만 본다.

### 7.3 `buildComparisonPlan` — 근거 확인 없이 "비교 가능"으로 뜨는 문제 (구조 문제 #3)

공통 axis가 있다는 사실만으로 비교가 "이용 가능"하다고 표시하던 것을 고쳤다. 이제 axis에 걸린 각 문서의 binding에 `facetCoverage`를 그대로 적용해 `coverage` 필드를 붙이고, 축 단위로 `both_sides_evidenced`(최소 두 문서가 `missing`이 아닌 상태로 실제 근거를 인용했는지)를 계산한다. 근거가 없는 쪽도 숨기지 않고 `coverage.status: "missing"`으로 그대로 보여준다 — §9 "보수적 실패" 원칙과 일치.

### 7.4 `existing_plan.claim_order` — 기존 순서 미기록 (구조 문제 #4)

`comparePlans`가 이제 `envelope.claims`의 실제 렌더링 순서를 `existing_plan.claim_order`(record id 배열)로 함께 기록한다. `semantic_plan.salience[].order`(새 레이어가 제안하는 순서)와 나란히 놓고 비교할 수 있게 됐다 — Stage B 설계 문서의 "순서... 나란히 기록한다" 요구를 완전히 충족한다(1차 실행 때는 새 레이어 쪽 순서만 기록했었다).

### 7.5 stale 여부가 로그에서 사라지는 문제 (구조 문제 #5)

`buildShadowPlan`이 이제 후보 문서 중 stale 판정된 것을 `stale_document_ids`로 모든 반환 경로에 포함하고, 오버레이가 하나도 없을 때의 `reason`을 `"no_resolved_document"` / `"overlay_stale"` / `"no_overlay_for_document"` 세 가지로 구분한다. "애초에 안 만들었다"와 "만들었는데 코어 데이터가 바뀌어 깨졌다"가 이제 로그에서 구분된다.

### 재실행 결과

`scripts/run_semantic_shadow_audit.js`로 50문항을 다시 재생한 결과, applicable 21/50·상태 분포(ambiguous 2 / unavailable 4 / partial 14)는 1차 실행과 동일하게 유지됐다(회귀 없음). 다만 로그 자체의 정보량이 늘었다 — 예를 들어 Q06의 chromatography facet은 이제 `exact: {covered:4, total:6}` / `section: {covered:4, total:18}`으로, Q49의 comparison binding은 양쪽 `coverage.status`와 `both_sides_evidenced: true`로 각각 정량화되어 기록된다.

테스트는 `test/engine_semantic_shadow.test.js`에 다섯 항목 각각에 대한 케이스를 추가해 15개로 늘렸다(기존 10개 + 남매 section 관련성 2개, section census fallback 1개, comparison coverage 주석 1개, claim_order/stale 2개, 관련 기존 케이스 보강).
