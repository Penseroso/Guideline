# 파생 의미 레이어 — 단계적 도입 기록 (Stage A–G)

`docs/derived_semantic_layer.md`가 설계 문서로서 계속 진화하는 동안, 그 문서의 "단계적 도입" 절이 담고 있던 Stage A부터 Stage G까지의 실제 구현·검증 서술을 이 파일로 옮겼다(2026-09-08 production cleanup). 원문은 그대로 보존했고, 재서술하지 않았다. 현재 아키텍처·계약·운영 방법은 `docs/derived_semantic_layer.md` 자체를, 현재 검증 baseline은 `docs/verification_status.md`를 참조한다.

---

### 단계 A — 계약과 소표본

- 두 JSON Schema와 validator를 만든다.
- 서로 다른 실패 유형을 대표하는 3~4개 범위만 구조화한다.
- 문서 overview, 다중 기준, 조건 분기, 문서 간 comparison을 각각 최소 한 건 포함한다.
- 기존 코어 데이터는 변경하지 않는다.

### 단계 B — shadow mode

- 의미 오버레이로 answer plan을 만들되 사용자 응답에는 아직 적용하지 않는다.
- 기존 50문항 감사 세트에서 기존 plan과 새 plan의 facet coverage, 순서, 비교 축을 나란히 기록한다.
- 새 레이어가 근거 recall을 줄이거나 범위를 과도하게 확장하면 해당 manifest를 `needs_review`로 되돌린다.

구현: `engine/semantic_overlay_store.js`(적재·staleness 필터·section 색인), `engine/semantic_routing.js`(당시 파일명 `engine/semantic_shadow.js` — facet-level plan 계산, envelope 비변경), `engine/semantic_shadow_log.js` + `engine/server.js`(`/api/ask` 응답 완성 후 로그만 append, 실패해도 응답에 영향 없음), `scripts/run_semantic_shadow_audit.js`(기존 50문항 결과를 재실행 없이 재생). 1차 실행 결과와 이후의 구조적 수정(대표 근거 1개 의존 제거, 남매 section 인식, comparison 근거 확인, 기존 순서 기록, stale 구분, chapter-scope facet의 분모 폭발 수정) 전체 기록: `history/verification/semantic_shadow_stage_b_2026-09-03.md`.

`test/engine_semantic_routing_regression.test.js`(당시 파일명 `test/engine_semantic_shadow_regression.test.js`)는 손으로 만든 envelope가 아니라 실제 엔진(`answerEnvelope`, LLM 미사용·결정적)에 감사 문항과 같은 실제 질문을 통과시켜 Q06/Q26/FDA ADA/Q49 각 대표 범위의 shadow plan이 안정적으로 나오는지 검증한다 — routing/retrieval 쪽 회귀는 기존 단위 테스트가 못 잡는 지점이라 별도로 추가했다.

`scripts/check_semantic_overlay_promotion.js`(`npm run check:promotion`)는 §11 기준 중 기계적으로 확인 가능한 것(schema/validator 통과, staleness 없음, 명시적으로 공급된 감사 입력에서 실제로 몇 번 발동했는지)을 점검해 manifest/comparison_binding별 워크시트를 출력한다. review_status는 쓰지 않는다. engineering completion과 final reviewed promotion을 분리하며, live 50문항 감사를 실행할 수 없으면 전자는 인정할 수 있지만 후자는 pending으로 유지한다.

### 단계 C — 검토 완료 범위만 활성화

- `reviewed`이고 hash가 최신인 객체만 답변에 사용한다.
- API route의 자연어 종합 박스부터 적용하고, 아래 구조 근거는 기존 citation contract를 유지한다.
- UI에 route, answer mode, coverage 상태 및 근거의 가이드라인/섹션 헤더를 표시한다.

**구현(2026-09-03)**: 처음엔 가장 좁은 범위(manifest 1개, `grounded_generation` route만)로 파일럿을 돌려 검증한 뒤, 같은 날 나머지 4개 manifest와 2개 comparison_binding까지 전부 `reviewed`로 승격하고 `structured` route까지 확장했다 — §11 기계적 기준(validator 통과·stale 없음·shadow 재생에서 실제 발동)을 전부 통과한 상태였고, Stage B에서 각각 실제 감사 결함(Q06/Q15/Q20/Q49)을 재현한 것들이었다. 구현: `engine/semantic_routing.js`(당시 `engine/semantic_shadow.js`)의 `buildReviewedSemanticCoverage()`(Stage B의 `buildShadowPlan`을 그대로 재사용, manifest·comparison_binding 양쪽 다 `reviewed` 필터만 추가), `engine/answer_envelope.js`(`grounded_generation`과 `structured` 두 성공 분기에서 호출, 실패해도 응답에 영향 없음), `web/render.js`의 `renderSemanticCoverage`(manifest facet coverage + comparison 축 양쪽 disclosure, 기존 대략적 coverage-warning과 시각적으로 분리된 박스). 전체 기록과 검증(모의 클라이언트 + 실 브라우저·실 LLM, structured/grounded_generation/comparison 세 경로 전부): `history/verification/semantic_stage_c_pilot_2026-09-03.md`. `summary_specs`의 개괄문과 salience 노출 순서는 아직 어디에도 연결되지 않았다 — §10의 세 조건 중 "coverage 상태 disclosure"만 다룬다. `refusal`/`source_excerpts` route는 의도적으로 제외했다.

### 단계 D — 범위 확장

- 질문 빈도나 특정 테스트 문항이 아니라 재사용 가능한 guideline section/topic 단위로 확장한다.
- 문서마다 작은 대표 표본을 먼저 검증한 뒤 인접 범위로 넓힌다.

**구현(2026-09-08)**: Wave 1보다 먼저 Stage D0에서 의미 오버레이 계약을 `0.2.0`으로, public answer contract를 `2.2.0`으로 마이그레이션했다. `coverage_basis`와 `effective` 분모를 schema/validator/engine/UI 전체에 연결하고 기존 오버레이·manifest 회귀를 통과시킨 뒤 section hierarchy 기반 authoring을 수행했다. shadow 진단은 router 결함을 드러내도록 넓게 유지하고, 실제 응답은 질문에 명시된 section/topic, answer intent, 인용 section 거리를 차례로 사용해 가장 정확한 reviewed manifest만 선택한다.

최종 inventory는 **중복 제거된 55개 unique manifest**다: document overview 6 + substantive parent section 42 + leaf process/conditional 5 + 독립 특화 manifest 2. 기존 5개 중 EMA FIH document overview, FDA ADA assay validation, FDA 2014 risk factors 3개는 새 계층형 범위에 흡수·마이그레이션했고, 독립 특화 의미를 유지하는 ICH M10 `run_acceptance`와 FDA ADA `screening_performance` 2개만 별도 manifest로 존치한다. 따라서 Wave별 작성 건수를 단순 합산한 수가 아니라 최종 파일에서 ID 중복을 제거한 실제 manifest 수가 55다.

`scripts/build_semantic_manifests.js`(당시 파일명 `scripts/build_semantic_stage_d.js`)가 질문과 독립적인 section inventory에서 overlay를 재생성하고, `scripts/audit_semantic_manifest_routing.js`(당시 `scripts/run_semantic_stage_d_audit.js`)가 authoring 이후 55개 전부를 shadow 및 future-served selector로 검증한다. `scripts/verify_semantic_manifests.js`(당시 `scripts/verify_semantic_stage_d.js`)는 direct-child topology, document area, leaf record membership, hash/staleness, 최종 수를 별도 granularity로 확인한다. 검증 과정에서 S6 Part I/II의 동명 `Notes` facet ID 충돌을 발견해 section 경로 기반 ID로 수정했다.

live 50문항 감사도 OpenAI same-provider cross-model 구성으로 50/50 완료했다. 기존 적합 16문항의 route/mode/claim ID가 모두 그대로였고, 전체 판정은 16 적합/34 부분 적합/0 부적합을 유지했다. 이 감사와 명시적 review attestation을 요구하는 `scripts/promote_semantic_stage_d.js`(2026-09-08 production cleanup에서 archive — 하드코딩된 구 answer contract `2.2.0`을 검증하는 별도 미공유 구현이었고, 대상 객체는 이미 전부 reviewed로 이 문서 작성 시점에 재실행 가치가 없어졌다)를 통해 최종 55개 manifest 및 참조 객체를 `reviewed`로 승격했다. 감사 실행 자체가 불가능한 환경에서는 `verify:semantic:manifests`의 engineering completion은 완료될 수 있으나 final reviewed promotion은 계속 pending이다.

이번 Stage D는 coverage disclosure 확장만 다룬다. 기존 `summary_specs`, presentation 문장, salience profile의 runtime 소비는 의도적으로 연결하지 않았으며 별도 후속 범위다.

### 단계 E — 세 미결 객체의 순차 활성화

Stage D가 남긴 세 개 — `summary_specs`, 한국어 presentation 문장, `salience_profiles` — 를 하나씩 별도 하위 단계로 활성화한다. 저작 범위는 기존 pilot 소표본(관련 manifest 5~7개)으로 한정하고, Stage D가 만든 47개 신규 manifest 전체로의 확장은 별도 **Stage F**로 미룬다.

**Stage E0(2026-09-08, 구현 완료) — salience_profiles 게이팅 선결 조건.** `salienceProfile`은 다른 다섯 객체와 달리 `review_status`가 스키마에 없어 "reviewed만 서빙" 규칙을 그대로 쓸 수 없었다. `data/schemas/derived_semantic_overlay.schema.json`에 `salienceProfile.review_status`를 필수 필드로 추가하고 `semantic_overlay_version`을 `0.2.0` → `0.3.0`으로 올렸다. `scripts/migrate_semantic_overlay_v0_3.js`(2026-09-08 production cleanup에서 archive — 완료된 일회성 스키마 버전 이관)가 기존 6개 오버레이의 salience_profiles 전체(7개)에 `review_status: needs_review`를 부여했다 — 지금까지 검토를 거친 적이 없으므로 정직한 초기값이다. 이 단계는 스키마·데이터만 바꾸고 engine/UI/envelope는 건드리지 않는다(공개 answer contract는 여전히 `2.2.0`). 검증: `npm test`(362/362), `node validation/validate_semantic_overlay.js`(6개 오버레이 + 3개 presentation 통과).

**Stage E1(2026-09-08, engineering completion) — `summary_specs` 구조 활성화.** 아직 문장 텍스트 없이, `facet_ids` 순서/`sentence_roles`만 서빙되는 manifest에 연결해 coverage disclosure의 facet 노출 순서에 반영한다(Stage B가 salience에 썼던 "shadow에는 다 보이고 reviewed 서빙 함수는 필터링" 패턴 재사용). `envelope_version` `2.2.0` → `2.3.0`. `engine/semantic_routing.js`(당시 `engine/semantic_shadow.js`)의 `selectServedSummary()`는 summary의 `target`이 manifest의 `target`과 정확히 일치하는 경우를 최우선으로 하고, 없으면 summary의 `facet_ids` 전체가 manifest의 facet 집합에 포함되는 경우(포함 매칭)를 대체 후보로 쓴다 — 후자는 ich_m3_r2/ich_s6_r1의 "scope" summary(§1.3 대상)가 더 넓은 "section_1_introduction" manifest(§1 대상)에 붙는 실제 사례를 커버한다. `scripts/run_semantic_stage_e1_audit.js`(`npm run audit:semantic:stage-e1`, 2026-09-08 production cleanup에서 archive — 좁은 사전 지정 pilot 범위 전용, 이후 `promote:semantic:summaries`의 범용 오프라인 감사로 대체)가 기존 5개 summary_spec 전부 의도한 manifest에 실제로 매칭되는지 오프라인으로 검증(5/5 확인 완료). `scripts/promote_semantic_stage_e1.js`(같은 이유로 archive)(`npm run promote:semantic:stage-e1`)는 Stage D와 동일하게 라이브 50문항 감사 + 기존 16개 적합 케이스 무회귀 + 검토 attestation을 요구한다 — 이후 이 환경에도 실제로 OPENAI_API_KEY가 있음이 확인되어(`.env`, dotenv로 로드) 현재 코드(계약 `2.5.0`) 기준 라이브 50문항 감사를 실행했고, 5개 summary_specs를 `reviewed`로 승격 완료했다(감사 중 Q25 하나가 established 16개 케이스의 claim 하나와 달라 보였으나, 재현·내용 검토 결과 코드 변경과 무관한 모델 표본 변동으로 판정 — `history/decision_log/review_log.md`의 REV-015). 상세: `history/verification/semantic_stage_e1_2026-09-08.md`.

**Stage E2(2026-09-08, engineering completion) — 한국어 semantic presentation 문장 렌더링.** E1의 구조에 `data/derived/presentation/ko/`의 reviewed·비-stale 문장을 채워 §7의 "한 개의 개괄 박스"로 노출한다. `envelope.prose`/`claims`에는 합류시키지 않는다(§9 금지 항목 — synthesized 문장이 생성 근거로 세탁되는 것을 방지) — `engine/answer_envelope.js`의 `grounded_generation` 분기는 LLM 호출(`answerFallback`)이 끝난 뒤에야 `envelope.semantic_coverage`를 계산하므로, 구조적으로 프롬프트 입력에 섞일 수 없다. `envelope_version` `2.3.0` → `2.4.0`.

`engine/semantic_overlay_store.js`는 이번에 처음으로 presentation 파일에도 staleness 검사를 적용한다 — 한 unit이라도 근거 hash가 낡으면 그 unit만 자르지 않고 entry 전체를 버린다(예: "scope" 문장에서 exception 문장 하나만 사라지면 범위가 실제보다 넓어 보일 수 있어, 부분 노출보다 미노출이 안전하다는 §2.6 원칙). `engine/semantic_routing.js`(당시 `engine/semantic_shadow.js`)의 `presentationTextFor()`는 summary_spec과 같은 `semantic_id`를 가진 presentation entry를 찾아 `review_status: reviewed`일 때만, summary_spec의 `sentence_roles` 순서로 정렬한 문장을 반환한다 — summary_spec의 review_status와 presentation entry의 review_status는 독립적이라, 구조는 승격됐지만 문장은 아직 검토 전인 상태(`text: null`)가 정상적으로 존재한다. `web/render.js`의 `renderCuratedOverview()`가 이 문장을 섹션/토픽 overview 레이아웃의 `section-overview-intro` 헤더 바로 아래, 기존 `synopsisText()`(원문 발췌) 박스와 시각적으로 분리해 렌더링한다.

`scripts/run_semantic_stage_e2_audit.js`(`npm run audit:semantic:stage-e2`, 2026-09-08 production cleanup에서 archive — 좁은 pilot 범위 전용)가 기존 presentation 3개 파일(ema_fih, ich_m3_r2, ich_s6_r1) 전부 올바른 sentence_roles 순서로 렌더링됨을 오프라인 확인(3/3). fda_ada/fda_ada_2014는 summary_spec은 있지만 presentation 파일 자체가 없어 이번 감사 대상이 아니며, `text: null`로 정상 fallback한다(Stage F 저작 대상). `scripts/promote_semantic_stage_e2.js`(같은 이유로 archive)도 E1과 동일한 게이트로 라이브 50문항 감사를 통과해 3개 presentation entry를 `reviewed`로 승격 완료했다. 상세: `history/verification/semantic_stage_e2_2026-09-08.md`.

**Stage E3(2026-09-08, engineering completion) — `salience_profiles` 노출 순서 적용.** `buildSaliencePlans`가 `target_id`를 반환하지 않아 Stage B 이후 문서 단위 분기가 죽은 코드였던 기존 버그를 고치고(§10 최상단 진단 참고), `selectServedSalience()`가 summary_spec과 동일한 "정확한 target 일치 우선, 없으면 facet 포함 매칭" 방식으로 salience_profile을 manifest에 연결한다. `servedSalience()`는 `reviewed`인 프로필만 `{ primary, supporting, detail }` facet ID 배열로 그룹핑하고(각 tier 내부는 `display_order` 순), `web/render.js`의 `renderSemanticCoverage`가 `detail` tier facet만 `<details>` 접이식 영역으로 옮기고 `primary`/`supporting`은 그대로 노출한다 — salience는 노출 순서를 좁힐 뿐 disclosure 자체를 좁히지 않는다는 원칙에 따라, salience가 아예 없거나 특정 facet을 언급하지 않으면 그 facet은 기본 노출된다. `envelope_version` `2.4.0` → `2.5.0`.

`scripts/run_semantic_stage_e3_audit.js`(`npm run audit:semantic:stage-e3`, 2026-09-08 production cleanup에서 archive — 좁은 pilot 범위 전용)가 기존 7개 salience_profile 전부(6개 문서에 걸쳐) 의도한 manifest에 실제로 매칭됨을 오프라인 확인(7/7). `scripts/promote_semantic_stage_e3.js`(같은 이유로 archive)도 동일한 게이트로 라이브 50문항 감사를 통과해 7개 salience_profiles를 `reviewed`로 승격 완료했다. 상세: `history/verification/semantic_stage_e3_2026-09-08.md`.

이로써 Stage E(요약문 구조 → 개괄 문장 → salience 노출)는 배선·오프라인 검증뿐 아니라 라이브 50문항 감사를 통한 최종 `reviewed` 승격까지 전부 완료됐다(summary_specs 5개, presentation entry 3개, salience_profiles 7개). 47개 신규 manifest로의 확장은 별도 Stage F 과제다.

### 단계 F — 신규 47개 manifest에 summary_specs/salience_profiles 확장(2026-09-08)

Stage D가 만든 55개 manifest 중 Stage E는 기존 pilot 소표본(5/7개)만 다뤘다. Stage F는 나머지에 `summary_specs`/`salience_profiles`를 기계적으로(새 한국어 문장 창작 없이) 확장한다.

**범위 결정**: `summary_specs.summary_kind` enum(`scope`/`section_overview`/`topic_overview`/`process_overview`)에 대응이 없는 `multi_criterion`/`comparison` 답변 유형 4개(run_acceptance, screening_performance, high_dose_selection, species_number_conditions)는 summary_spec 대상에서 제외했다 — 목록형 답변에는 "개괄 문단"이라는 답변 형태 자체가 맞지 않는다. 나머지 51개 중 기존 5개가 커버하는 5개를 뺀 **46개 후보 중 45개**에 새 summary_spec을 만들었다(1개는 실제로 이미 포함 매칭으로 커버되고 있어 제외). facet 5개 이상인 manifest에는 salience_profile도 함께 만들었다(19개 신규). **한국어 개괄 문장(presentation) 저작은 이번 범위에서 완전히 제외** — 조사 결과 다수 상위 섹션(예: ich_m3_r2 §5, §11)이 상위 문단 자체에는 직접 근거 문장이 없고 하위 번호 섹션에만 내용이 있어, 이미 검토된 문장 직접 인용만으로는 상당수가 `text: null`로 남는다. 새 한국어 문장을 합성 저작하는 것은 정확성 위험이 커서 사용자가 별도 매뉴얼 단계로 미루기로 결정했다 — 그래서 이번에 만든 45개 summary_spec은 모두 구조만 있고 `text: null`이며, 이는 Stage E2가 이미 정립한 정상 fallback과 동일하다. (2026-09-08 S6(R1) 13-facet 구조 백필 이후 S6(R1) 관련 부분은 실제 근거로 채워졌다 — `docs/milestone_log.md` 및 `docs/coverage/ich_s6.md` 참조.)

**엔진/렌더링/스키마 변경 없음**: `engine/semantic_routing.js`(당시 `engine/semantic_shadow.js`)의 `selectServedSummary()`/`selectServedSalience()` 매칭 로직(정확한 target 일치 → facet 포함 매칭)이 이미 범용적이라, 새 데이터만 추가하면 자동으로 연결된다. overlay 계약(`0.3.0`)과 answer contract(`2.5.0`) 모두 그대로다.

**`scripts/build_semantic_summaries.js`(당시 파일명 `scripts/build_semantic_stage_f.js`)**: `answer_intent → summary_kind` 매핑으로 summary_spec을 생성하고(`facet_ids`는 manifest 자신의 기존 coverage_groups facet을 그대로 사용, 새로 만들지 않음), `evidence_refs`는 대표 facet에서 실제 코어 record를 찾아 채운다(`declared_members`면 `member_record_ids[0]`, `section_census`면 해당 섹션·자손 섹션에서 사전식으로 가장 앞선 실제 record — 자손까지 뒤져도 없으면 manifest 자신의 target 섹션 자체의 직접 근거로 최종 폴백; ich_s6_r1 §5의 네 자식 섹션이 전부 비어 있고 §5 자체에 근거가 있는 실제 사례가 있었다). salience_profile의 `tier`/`rationale_code`는 각 facet에 이미 있는 검증된 `semantic_role`(definition/purpose/scope/criterion/condition/exception/procedure_step/risk_factor/evidence/boundary)로부터 결정론적으로 도출한다(새 판단이 아니라 기존 분류 재사용) — facet 5개 미만인 manifest는 tier 구분 실익이 없어 건너뛴다. 이미 어떤 summary_spec/salience_profile이 커버하는 manifest는(정확한 target 일치 또는 facet 포함 매칭) 건너뛰어 중복을 만들지 않는다.

**`scripts/audit_semantic_summary_routing.js`(당시 파일명 `scripts/run_semantic_stage_f_audit.js`)**: Stage F가 새로 만든 45개 summary_spec과 19개 salience_profile 전부, "everything reviewed" 가정 하에 서빙 선택기가 의도한 manifest에 실제로 매칭되는지 오프라인 확인(45/45, 19/19).

**`scripts/promote_semantic_summaries.js`(당시 파일명 `scripts/promote_semantic_stage_f.js`)**: Stage E와 동일한 게이트(schema 검증 + 오프라인 감사 클린 + 현재 `ENVELOPE_VERSION`(2.5.0) 기준 라이브 50문항 감사 + established 16개 무회귀 + 검토 attestation). Stage F는 엔진 코드를 전혀 바꾸지 않으므로 Stage E0~E3 승격에 썼던 것과 동일한 라이브 감사 결과(및 Q25 조정 baseline)를 재사용해 그대로 승격했다. 45개 summary_spec + 19개 salience_profile 전부 `reviewed`로 승격 완료.

상세: `history/verification/semantic_stage_f_2026-09-08.md`.

### 단계 G — 한국어 semantic presentation 전수화(2026-09-08)

Stage G는 적용 가능한 reviewed `summary_spec` 50개 전부에 한국어 presentation entry를 제공한다. 기존 3개 entry를 presentation 계약 `0.2.0`으로 이관하고 47개를 새로 저작했다. 저작은 summary 단위, 검증은 문장별 entailment와 facet completeness 단위로 분리했으며 서로 다른 generator/verifier 모델을 사용했다. 상위 section에 직접 본문 record가 없는 경우 첫 하위 record를 전체 대표로 확대하지 않고, 근거가 있는 하위 facet의 주제를 보수적으로 나열했다.

`summary_spec_sha256`는 summary의 target, kind, facet 순서, sentence role 변경을 source hash와 별도로 감지한다. `facet_dispositions`는 각 summary facet을 `covered` 또는 명시적 `gap`으로 완전 분할한다. reviewed entry에서 허용되는 gap은 실제 구조화 record가 없는 `no_structured_evidence`뿐이다. **당시 허용된 gap은 S6(R1)의 13개 facet이었으나, 같은 날 후속 구조 백필로 전부 해소됐다 — 현재는 0건이다(`npm run audit:semantic:presentation`, `docs/milestone_log.md` 참조).**

`npm run audit:semantic:presentation`은 fresh reviewed entry, 한국어 문자, 숫자 근거, gap allowlist를 검사한다. runtime loader는 source evidence hash 또는 `summary_spec_sha256`가 불일치하면 entry 전체를 탈락시킨다. semantic overlay 계약 `0.3.0`, public answer contract `2.5.0`, route/claims/citations/manifest coverage 계산은 변경하지 않았다. post-activation 50문항 감사와 Stage F baseline 비교에서 established suitable 16/16의 route, mode, claim ID 집합이 동일했다.

---

## 승인 기록 (당시)

**승인 기록(2026-09-07)**: 8개 활성화 승인 기준 중 기계적으로 확인 가능한 것(schema/validator 통과, stale 제외)은 `npm run check:promotion`이 계속 통과시켰고, 나머지는 2026-09-07 최종 재감사(`history/verification/answer_suitability_audit_2026-09-07_complete.md`, 16 적합/34 부분 적합/0 부적합)로 판정했다.

세 번째 기준은 실제 승인 논리인 "부적합 감소 + 기존 적합 무회귀"로 확정하며, 종전의 "전체 적합 수 증가 + 기존 적합 무회귀" 문구를 대체한다. 종전 문구는 문자 그대로는 미충족이었다(적합 16→16). Stage C가 disclosure-only이고 후속 수정도 누락 근거 회복에 집중되어 답변 조립·서식을 적합 수준으로 재설계하지 않았다는 범위 제약을 명시적으로 인정한 정책 변경이다. 최종 재감사에서는 부적합 5→0, 원 적합 16문항의 회귀 0건으로 개정 기준을 충족했고, 나머지 7개 기준도 모두 충족을 확인했다.

**Stage C 승인 완료.** 단계 D(범위 확장)를 진행할 수 있다. 다만 두 가지는 이 승인 범위 밖의 별도 과제로 남았다: (1) `summary_specs`/`data/derived/presentation/ko/`의 개괄문 소비 로직은 아직 어디에도 연결되지 않았다(당시 각주) — overview 질문에 개괄문을 붙이는 확장은 이번 승인이 다루는 coverage disclosure와 별개다. (2) Q06처럼 콘텐츠는 완전하지만 서식(별도 묶음/표) 요건 때문에 적합 문턱을 못 넘는 패턴은 답변 조립/렌더링 레이어의 별개 개선 과제다(REV-014 계열, `history/decision_log/review_log.md` 참조).

## 구현 시 스키마 영향 체크리스트 (당시, 전부 완료)

원 설계 문서가 구현 착수 시 요구했던 체크리스트. 전부 완료됐다.

1. 두 신규 JSON Schema 추가
2. `docs/schema.md`에 파생 오버레이를 정식 데이터 계층으로 등록
3. 참조·hash·cycle·coverage validator 추가
4. 대표 소표본 데이터 추가 및 `needs_review` 상태 명시
5. 답변 엔진의 shadow-mode loader와 진단 로그 추가
6. 관련 구조 데이터 및 전체 회귀 검증 실행

---

## Addendum: docs/schema.md's English-language Stage B–G implementation log (moved here verbatim, 2026-09-08 production cleanup)

docs/schema.md's own "Derived semantic overlay" section carried this parallel, more implementation-specific (file/function-level) English narrative alongside the Korean design document's own Stage A–G account above. Moved here rather than deleted — the two accounts complement each other and neither fully subsumes the other. Current script names have been annotated inline; the prose itself is unedited.

### Stage A (initial scoping)

Four representative scopes were structured as the initial samples, chosen to cover the failure categories the 50-question answer-suitability audit attributed to missing derived structure (`history/verification/answer_suitability_audit_2026-09-02.md` §6): a document overview (`data/derived/semantic/ema_fih.json`), an assay-technique conditional branch (`data/derived/semantic/ich_m10.json`), a multi-criterion topic breakdown (`data/derived/semantic/fda_ada.json`), and a cross-document applicability comparison (`data/derived/semantic/ich_m3_r2.json` and `ich_s6_r1.json`, bound through the shared `scope.product_or_matrix` axis). Stage A was then extended to cover the two remaining 부적합-rated questions from the same audit that weren't yet represented: `fda_ada.json` gained a `screening_performance` manifest (Q15 — ADA screening-assay performance parameters, spanning §VI.B and the relevant §IV subsections) and `fda_ada_2014.json` was authored as that document's first-ever overlay (Q20 — patient/product immunogenicity risk-factor categories, §V.A/§V.B). All 6 guideline documents ended up with at least one overlay scope. See `history/verification/semantic_shadow_stage_b_2026-09-03.md` §9 for the replay results and two more general fixes this expansion forced (a chapter-scoped facet with zero curated members could never reach `"covered"`; a facet-targeted overview manifest could go silently unreported when the router resolved sections sharing no ancestor/sibling with it at all).

### Stage B: shadow mode

`engine/semantic_overlay_store.js` loads these overlays at server startup (dropping any document whose `source_bundle_sha256` no longer matches the live core bundle) and `engine/semantic_routing.js` (then `engine/semantic_shadow.js`) builds a facet-level plan from them for the document(s) an already-finished answer envelope resolved to. `engine/server.js`'s `/api/ask` handler calls this — wrapped in `try`/`catch` so a failure here can never affect the response — strictly after the real envelope is built, and appends the comparison to `logs/runtime/semantic_shadow.jsonl` (`engine/semantic_shadow_log.js`) — no route, mode, or served answer is affected. This is Stage B of the design document's staged-introduction plan ("의미 오버레이로 answer plan을 만들되 사용자 응답에는 아직 적용하지 않는다").

`scripts/run_semantic_shadow_audit.js` replays the already-captured 50-question answer-suitability audit envelopes through this comparison without re-running the LLM, and `history/verification/semantic_shadow_stage_b_2026-09-03.md` records both the first pass and a same-day structural revision: the shadow plan independently reproduced the Q06 and Q26 findings from the human audit, and the first pass surfaced five algorithm-level gaps (not per-question quirks) — relevance matching missed sibling sections, facet coverage depended entirely on one hand-curated sample record per facet, comparison bindings were reported with no check that either side had actual evidence, the existing engine's own presentation order was never captured for the "record both plans' order side by side" requirement, and a stale overlay was indistinguishable from one that was never authored. All five were fixed in `engine/semantic_routing.js`/`engine/semantic_overlay_store.js` (a per-section record census replaces the single-sample coverage denominator; sibling-section relevance; per-side comparison-binding coverage with a `both_sides_evidenced` flag; `existing_plan.claim_order`; a distinct `overlay_stale` reason) and covered by `test/engine_semantic_routing.test.js`. Verifying the new census against real section sizes then surfaced a sixth gap — a facet scoped to a whole multi-subsection chapter (e.g. `ema_fih`'s `dose_selection`, §7, ~197 records across 7 sub-sections) got a record-recall denominator no real answer could approach, reading as permanently near-zero regardless of answer quality. `measureSectionCoverage` switches denominator shape based on whether the facet's scope section actually has child sections: leaf-scoped facets keep record-level recall, chapter-scoped facets measure "how many of its own named sub-sections were touched" instead — a rule derived from the core section tree shape, not hardcoded per facet.

Two more pieces closed out Stage B: `test/engine_semantic_routing_regression.test.js` drives real questions through the actual (offline, deterministic) engine rather than hand-built envelopes, so a regression in routing/retrieval itself — not just in `engine/semantic_routing.js` — has a test that would catch it. `scripts/check_semantic_overlay_promotion.js` (`npm run check:promotion`) is a read-only worksheet against the design document's activation criteria. It never writes `review_status`.

### Stage C

The design document's activation rule — "reviewed이고 hash가 최신인 객체만 답변에 사용한다" — makes promotion a verification-pipeline decision. Stage A first promoted 5 coverage manifests and two `scope.product_or_matrix` comparison bindings. `engine/semantic_routing.js`'s `buildReviewedSemanticCoverage()` reuses Stage B's `buildShadowPlan()` unchanged, filters manifests and comparison bindings to `reviewed` only. `engine/answer_envelope.js` calls it on both the `grounded_generation` and `structured` success paths, attaching the result as `envelope.semantic_coverage`. `web/render.js`'s `renderSemanticCoverage` renders the disclosure box. Full writeup: `history/verification/semantic_stage_c_pilot_2026-09-03.md`.

### Stage D

Generated a final, de-duplicated inventory of **55 unique coverage manifests**: 6 document overviews + 42 substantive parent sections + 5 leaf process/conditional topics + 2 independent specialized manifests. `scripts/build_semantic_manifests.js` (then `build_semantic_stage_d.js`) performs hierarchy-driven authoring, `scripts/audit_semantic_manifest_routing.js` (then `run_semantic_stage_d_audit.js`) exercises all 55 manifests after authoring, `scripts/verify_semantic_manifests.js` (then `verify_semantic_stage_d.js`) independently checks topology/membership/staleness/uniqueness. `scripts/promote_semantic_stage_d.js` (archived 2026-09-08 — hardcoded stale answer contract `2.2.0`, unshared regression-guard copy, target objects already fully reviewed) required the live-audit gate before writing `reviewed`. The 2026-09-08 audit completed 50/50 with 16 suitable, 34 partially suitable, 0 unsuitable; all 55 manifests reviewed, 55/55 selected.

### Stage E0

`salienceProfile` needed a `review_status` field to be gated like every other overlay object. `data/schemas/derived_semantic_overlay.schema.json` added it as required; `semantic_overlay_version` moved to `0.3.0`. `scripts/migrate_semantic_overlay_v0_3.js` (archived 2026-09-08 — completed one-time schema bump) migrated all 6 overlays' salience_profiles to `needs_review`.

### Stage E1

`selectServedSummary()` attaches the matching summary_spec to each manifest plan; `buildReviewedSemanticCoverage()` exposes it only when `reviewed`. `ENVELOPE_VERSION` `2.2.0` → `2.3.0`. `scripts/run_semantic_stage_e1_audit.js`/`promote_semantic_stage_e1.js` (both archived 2026-09-08 — narrow fixed pilot scope, superseded by the generic `audit:semantic:summaries`/`promote:semantic:summaries`) verified and promoted the 5 pre-existing summary_specs to `reviewed`. Full record: `history/verification/semantic_stage_e1_2026-09-08.md`.

### Stage E2

`presentationTextFor()` renders the matching reviewed Korean presentation entry as the summary's `text`. `ENVELOPE_VERSION` `2.3.0` → `2.4.0`. `scripts/run_semantic_stage_e2_audit.js`/`promote_semantic_stage_e2.js` (both archived, same reason as E1's) verified and promoted the 3 pre-existing presentation entries. Full record: `history/verification/semantic_stage_e2_2026-09-08.md`.

### Stage E3

Fixed a latent dead-code bug in `buildSaliencePlans()` (missing `target_id`); `selectServedSalience()`/`servedSalience()` now expose reviewed salience tiers, rendered by `web/render.js` with `detail`-tier facets collapsed. `ENVELOPE_VERSION` `2.4.0` → `2.5.0`. `scripts/run_semantic_stage_e3_audit.js`/`promote_semantic_stage_e3.js` (both archived, same reason) verified and promoted the 7 pre-existing salience_profiles. Full record: `history/verification/semantic_stage_e3_2026-09-08.md`.

### Stage F

Extended `summary_specs`/`salience_profiles` (structure only, no engine/schema change) to the 47 manifests Stage D added but Stage E's pilot scope didn't cover — 45 new summary_specs, 19 new salience_profiles, all `text: null`. `scripts/build_semantic_summaries.js` (then `build_semantic_stage_f.js`) generates them mechanically from each manifest's existing facets/evidence. `scripts/audit_semantic_summary_routing.js` (then `run_semantic_stage_f_audit.js`) verified attachment (45/45, 19/19).

The original promotion reused a pre-activation live audit — later found to prove nothing about post-activation behavior. `scripts/semantic_promotion_lifecycle.js` (then `stage_e_promotion_shared.js`) gained `computeSemanticStateFingerprint()`, and the promote script (then `promote_semantic_stage_f.js`, now `promote_semantic_summaries.js`) was restructured to flip-then-verify — later generalized into the full prepare/verify/finalize/rollback lifecycle (see main milestone entry). A fresh post-activation audit confirmed 15/16 established-suitable cases exact-matched (Q25's variance — REV-015 — later resolved by generalizing the regression policy, not special-casing Q25); all 43 summary/27 salience occurrences attached correctly; zero `detail`-tier items existed at the time. Full record: `history/verification/semantic_stage_f_2026-09-08.md`.

### Stage G

Provided fresh reviewed Korean presentation entries for all 50 applicable summary_specs (47 new, 3 migrated). `facet_dispositions` exhaustively classifies each summary's facets as `covered` or an explicit `gap`. Thirteen S6(R1) facets had no structured record and remained `no_structured_evidence` gaps at the time — **closed the same day by a structural backfill of the underlying source records; current gap count is 0** (`docs/milestone_log.md`, `docs/coverage/ich_s6.md`). No route/claim/citation/envelope-shape change.
