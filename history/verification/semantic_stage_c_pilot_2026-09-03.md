# Stage C: ema_fih 문서 개요 manifest 활성화, 이후 full 확장

실행일: 2026-09-03

적용 대상: `docs/derived_semantic_layer.md` §10 단계 C — "검토 완료 범위만 활성화."

상태: §1~§4.1은 1차 파일럿(manifest 1개, grounded_generation route만) 기록. **§6에서 같은 날 나머지 4개 manifest + 2개 comparison_binding을 모두 승격하고 structured route까지 확장했다** — 현재 시점 최종 상태는 §6을 보라.

## 1. 범위를 왜 이렇게 좁혔는가

Stage B(`history/verification/semantic_shadow_stage_b_2026-09-03.md`)까지는 파생 의미 레이어가 순수 진단·로그 전용이었다 — 사용자가 보는 답변은 한 글자도 안 바뀌었다. Stage C는 처음으로 실제 서빙 답변에 반영하는 단계라, 사용자 승인 아래 의도적으로 다음 두 축으로 좁혔다.

1. **manifest 1개만**: `ema_fih.sem.manifest.document_overview`. Stage B에서 §11 승인 기준 중 기계적으로 확인 가능한 부분(schema/validator 통과, stale 없음, 최근 50문항 재생에서 11회 발동해 실제로 partial/unavailable을 정확히 구분)을 통과했고, 실제 재생 결과 Q26/Q50에서 사람 감사가 잡은 결함(EMA FIH 전체 개요가 dose-selection 절로 축소됨)을 독립적으로, 정량적으로 재현한 바로 그 manifest다.
2. **API 생성 route의 종합 박스만**: `docs/derived_semantic_layer.md` §10 Stage C의 첫 항목이 명시한 정확한 시작점이다 — "API route의 자연어 종합 박스부터 적용하고, 아래 구조 근거는 기존 citation contract를 유지한다." `structured` route나 다른 manifest는 이번에 전혀 건드리지 않았다.

## 2. 무엇을 "적용"했는가 — 그리고 무엇을 하지 않았는가

의도적으로 **공개(disclosure) 전용**으로 구현했다. LLM에게 이 manifest의 coverage_group을 프롬프트로 넘겨 "이 5개 영역을 다 다뤄서 답해라"라고 생성을 유도하는 것은 하지 않았다 — 그건 실제 생성 품질에 영향을 주는 별도의, 더 위험한 다음 단계다. 이번에 한 일은:

- 이미 생성된 답변(`prose`, `claims`)은 전혀 건드리지 않는다.
- 그 답변이 실제로 몇 개 영역을 다뤘는지를 Stage B와 정확히 같은 계산식(`engine/semantic_shadow.js`의 `buildShadowPlan`)으로 재사용해 계산하고, **`review_status: "reviewed"`인 manifest만 걸러서** 응답에 새 필드로 얹는다.
- 그 필드가 있으면 UI가 "세부 항목 커버리지" 박스를 보여준다.

## 3. 구현

### 승격

`data/derived/semantic/ema_fih.json`의 `ema_fih.sem.manifest.document_overview` 객체 하나만 `review_status`를 `needs_review` → `reviewed`로 바꿨다. 이 manifest가 참조하는 5개 facet은 Stage A 저작 시점부터 이미 `reviewed`였다(대표 근거가 원문에서 직접 확인됨) — manifest 자체(coverage_group 구성이라는 해석적 판단)만 `needs_review`였다. `summary_specs`/`salience_profiles`는 이번 파일럿이 소비하지 않으므로 그대로 `needs_review`로 뒀다. bundle hash는 코어 데이터가 안 바뀌었으므로 재계산 불필요.

### 엔진

- `engine/semantic_shadow.js`에 `buildReviewedSemanticCoverage(question, envelope, options)` 추가. `buildShadowPlan`을 그대로 재사용하고 `review_status !== "reviewed"`인 manifest만 걸러낸다. 아무것도 안 남으면(대부분의 문서·질문이 여기 해당) `null` — 필드 자체가 없는 것과 "빈 결과"를 구분하지 않아 UI가 빈 박스를 그릴 일이 없다.
- `engine/answer_envelope.js`의 `grounded_generation` 성공 분기에서만 이 함수를 호출해 `envelope.semantic_coverage`로 얹는다. `structured`/`source_excerpts`/`refusal` 경로는 전혀 건드리지 않는다. `safeReviewedSemanticCoverage`로 감싸 어떤 예외도 삼킨다 — 이미 완성된 답변이 이 부가 기능 때문에 실패하거나 지연되는 일은 구조적으로 불가능하다(Stage B의 shadow 로깅과 같은 안전 패턴).

### UI

`web/render.js`에 `renderSemanticCoverage` 추가, 질문 헤더(`renderAnswerScope` 바로 다음)에서 호출. `envelope.semantic_coverage`가 없으면 아무것도 렌더링하지 않는다. 있으면:

- manifest 상태 문구(complete/partial/ambiguous/unavailable, `web/i18n.js`에 새 키 5개 추가)
- 상태가 missing/partial인 facet들을 "확인되지 않은 항목" 태그 목록으로

기존의 대략적인 `coverage-warning`(amber, `--warn`)과 시각적으로 구분되도록 별도 색상(`--accent`, 초록 계열)과 별도 CSS 클래스(`semantic-coverage`)를 썼다 — 이 둘은 서로 다른 정밀도의 신호라서 섞이면 안 된다.

## 4. 검증

### 단위/통합 테스트

- `engine/semantic_shadow.js`: `buildReviewedSemanticCoverage`는 기존 Stage B 테스트가 이미 검증한 `buildShadowPlan`을 그대로 재사용하므로 별도 로직 테스트는 필터링(`review_status==="reviewed"`) 하나뿐 — `test/engine_answer_envelope.test.js`의 통합 테스트가 이를 실제 승격된 manifest로 검증한다.
- `test/engine_answer_envelope.test.js`: 신규 4개 — (1) 실제 promote된 manifest가 실제 grounded_generation 응답에 정확한 facet coverage와 함께 나타남, (2) 아직 승격 안 된 문서(fda_ada)의 질문은 `semantic_coverage: null`, (3) `structured` route는 필드 자체가 `undefined`, (4) 내부 실패 시 `safeReviewedSemanticCoverage`가 `null`을 반환하고 예외를 흘리지 않음(포이즌드 claim getter로 강제 재현).
- `test/web_render.test.js`: 신규 3개 — 필드 없으면 렌더링 없음, 있으면 별도 박스로 렌더링되고 missing facet만 나열(covered facet 미포함), 알 수 없는 status가 "undefined" 문자열을 노출하지 않음.
- 전체 327개 테스트 통과, 기존 회귀 없음.

### 실제 API 확인 (모의 클라이언트)

`engine/answer_envelope.js`를 모의 generator/verifier 클라이언트로 직접 호출해 "EMA FIH 가이드라인은 첫 투여 전에 뭘 종합해서 보라는 거야?" 질문을 실행한 결과:

```
route/mode: grounded_generation generated
semantic_coverage.manifests[0] = {
  manifest_id: "ema_fih.sem.manifest.document_overview",
  status: "partial",
  facets: scope=missing, quality=missing, non_clinical=missing,
          dose_selection=covered, trial_planning=missing
}
```

Q26/Q50의 실제 사람 감사 결함(§7 dosing만 다루고 나머지 4개 영역을 놓침)이 실제 서빙 경로에서 최초로 사용자에게 노출 가능한 형태로 나타난다.

### 브라우저 확인

실제 로컬 서버(`npm run serve`, 설정된 OpenAI 키 사용)를 띄우고 브라우저에서 같은 질문("EMA FIH 가이드라인은 첫 투여 전에 뭘 종합해서 보라는 거야?")을 직접 실행했다. route는 `grounded_generation`("근거 기반 생성 · 종합 답변" 배지)으로 실제 생성됐고, "세부 항목 커버리지" 박스가 렌더링됐다:

```
세부 항목 커버리지
일부 세부 항목이 빠졌을 수 있습니다.
확인되지 않은 항목
scope / quality / non clinical / dose selection / trial planning
```

이 실행에서는 5개 facet 전부 "확인되지 않음"으로 나왔다 — 실제 LLM 생성 결과가 이번 호출에서는 어느 facet의 큐레이션된 대표 근거와도 정확히 일치하지 않았다는 뜻이며(생성마다 달라질 수 있는 실제 변동성이지 렌더링 버그가 아니다), `semantic_coverage`가 계산한 그대로를 정직하게 보여준 것이다.

시각적으로는 기존의 대략적인 amber `coverage-warning`("부분 범위 답변") 박스 바로 아래에, 초록 계열 왼쪽 테두리와 초록 제목으로 명확히 구분되어 렌더링됐다. 텍스트 겹침이나 스타일 안 먹은 원본 HTML 노출 없이 깔끔하게 표시됐고, missing facet은 `answer-scope`의 근거 범위 태그와 동일한 pill 스타일로 나열됐다.

## 4.1 곁가지 수정: "이 답변의 근거 범위" pill 그룹화

브라우저 확인 중 사용자가 지적: 새 `semantic-coverage` 박스(짧은 facet 이름 pill)와 나란히 보니 기존 `answer-scope`(근거 범위) 섹션의 pill이 지나치게 넓어 보였다. 원인은 `renderAnswerScope`(`web/render.js`, Stage C 이전부터 있던 기존 코드)가 인용마다 `가이드라인 코드 + §섹션 + 제목`을 pill 하나에 통째로 넣어서, 같은 가이드라인 안에 섹션이 여러 개면 코드가 pill마다 반복되던 것.

가이드라인 코드를 그룹 헤딩으로 한 번만 빼고 그 아래에 `§번호 제목`만 짧게 나열하도록 고쳤다(여러 문서가 섞인 답변은 문서별로 별도 그룹). `test/web_render.test.js`에 2개 추가(같은 가이드라인 내 여러 섹션이 헤딩 하나로 묶이는지, 서로 다른 가이드라인은 별도 그룹으로 유지되는지) — 전체 329개 테스트 통과. 브라우저에서 M10 taxonomy 질문("M10에서 분석법 밸리데이션 종류는 어떻게 나뉘어?")으로 재확인: `M10  §2.2.1 Full Validation  §2.2.2 Partial Validation  §2.2.3 Cross Validation`로 렌더링됨 — 가이드라인 코드가 한 번만 나오고 섹션 pill은 짧다.

Stage C와는 독립적인 수정이다(모든 route에 적용되는 기존 UI 요소) — 같은 세션에서 발견·수정했을 뿐, 승격/manifest 로직과는 무관하다.

## 5. 1차 파일럿 결론

세 가지 검증(모의 클라이언트 통합 테스트, 단위/렌더 테스트 327개, 실제 브라우저+실LLM 확인)이 모두 일치한다 — Stage C 1차 파일럿이 설계대로 동작한다. 구조 근거·인용 계약은 전혀 안 바뀌었고, 딱 1개의 승격된 manifest만 딱 1개의 route에서만 새 disclosure를 추가했다.

## 6. Full 확장 (같은 날, 사용자 지시로 진행)

사용자가 "가능하면 full로 확장"을 지시해 같은 날 진행했다. §11 기준 재확인 결과(`npm run check:promotion`) 나머지 4개 manifest도 전부 기계적 기준(validator 통과·stale 없음·최근 50문항 재생에서 실제 발동: `ich_m10.run_acceptance` 2회, `fda_ada.assay_validation` 13회, `fda_ada.screening_performance` 12회, `fda_ada_2014.risk_factors` 12회)을 충족한 상태였다.

### 6.1 전체 승격

다음 4개 manifest를 `needs_review` → `reviewed`로 승격했다(전부 이미 §11 기계적 기준 통과, Stage B에서 실제 감사 결함을 재현한 것으로 검증됨):

- `ich_m10.sem.manifest.run_acceptance` (Q06 — assay 기술 분기)
- `fda_ada.sem.manifest.assay_validation` (5단계 밸리데이션 taxonomy)
- `fda_ada.sem.manifest.screening_performance` (Q15 — screening 성능 기준)
- `fda_ada_2014.sem.manifest.risk_factors` (Q20 — 환자/제품 위험요인)

`ich_m3_r2`/`ich_s6_r1`의 `scope.product_or_matrix` comparison_binding 2개는 Stage A 저작 시점부터 이미 `reviewed`였다(§4.6 근거가 직접 확인된 axis binding이라 별도 해석적 판단이 필요 없었음).

### 6.2 엔진 확장: structured route + comparison 축

1차 파일럿은 `grounded_generation` route에만 disclosure를 붙였는데, 승격된 5개 manifest 중 다수의 **실제 발동 경로는 structured route**다(예: Q06은 `route:"structured", mode:"multi_criterion"`) — grounded_generation에만 남겨두면 방금 승격한 manifest 대부분이 사용자에게 노출될 기회가 없었다. 그래서:

- `engine/answer_envelope.js`의 두 번째 반환 분기(`route:"structured"`, `match`가 있고 생성으로 안 가는 경로)에도 동일한 `safeReviewedSemanticCoverage` 호출을 추가했다. `grounded_generation` 분기와 완전히 같은 안전 계약(실패해도 응답에 영향 없음, prose/claims 불변)을 그대로 재사용한다.
- `engine/semantic_shadow.js`의 `buildReviewedSemanticCoverage`를 확장해 `comparison`(Stage B의 `buildShadowPlan`이 이미 계산하는 축 정보)도 `reviewed`인 binding만 걸러서 함께 반환하도록 했다 — 축 하나당 최소 2개 문서가 `reviewed` 상태로 남아야 그 축을 노출한다(둘 다 있어야 "비교"가 성립한다는 `buildComparisonPlan`의 기존 규칙과 동일).

### 6.3 UI 확장: 비교 축 disclosure

`web/render.js`의 `renderSemanticCoverage`가 이제 `semantic_coverage.manifests`뿐 아니라 `semantic_coverage.comparison`도 렌더링한다. 각 축마다 "비교 축 근거" 라벨 아래 문서별(가이드라인 코드 라벨 + coverage 상태) 목록을 보여준다. 가이드라인 라벨은 별도 조회 테이블 없이 `envelope.claims[].citation.guideline_code`에서 그대로 가져온다(이미 `answer-scope`가 쓰는 것과 같은 데이터).

### 6.4 검증

- 단위/통합 테스트: `test/engine_semantic_shadow.test.js`에 `buildReviewedSemanticCoverage` 전용 3개(미승격 manifest 필터링을 가짜 store로 직접 검증, 실제 store 대비 승격 확인, comparison 축의 reviewed 필터링), `test/engine_answer_envelope.test.js`의 기존 "structured route는 필드가 없다"/"fda_ada는 아직 미승격" 테스트 2개를 전부 승격된 현재 상태에 맞게 교체(3개로: 진짜 무관한 M10 glossary 질문은 `null`, Q06 질문은 structured route에서 `ambiguous`로 나타남, M3/S6 비교는 `comparison` 축을 반환), `test/web_render.test.js`에 비교 축 렌더링 1개 추가. 전체 334개 테스트 통과.
- `npm run shadow:semantic` 재실행: applicable 28/50 → 28/50(수치 자체는 승격 여부와 무관 — Stage B의 shadow 계산 로직 자체는 review_status를 안 보므로 그대로다). 승격은 "로그에 뭐가 잡히는지"가 아니라 "그중 뭐가 실제 서빙 답변에 노출되는지"를 바꾼다.
- 브라우저 재확인(`npm run serve`, 실 OpenAI 키): (1) Q06 실제 문구 → route "구조화 근거 / multi_criterion", "세부 항목 커버리지" 박스가 "질문에서 조건이 명확하지 않아 여러 항목을 함께 표시합니다"와 함께 `chromatography`/`lba` 둘 다 미확인 태그로 표시 — Q06의 실제 결함이 **structured route**에서 처음으로 사용자에게 노출됨. (2) M3 vs S6 비교 질문 → route "구조화 근거 / 비교", 새 "비교 축 근거" 블록이 "S6(R1): 일부 세부 항목이 빠졌을 수 있습니다.  ICH M3(R2): 일부 세부 항목이 빠졌을 수 있습니다."를 표시. 둘 다 레이아웃 깨짐 없이 깔끔하게 렌더링됨.

### 6.5 아직 안 한 것

- `summary_specs`의 개괄문·`salience_profiles`의 노출 순서를 실제 생성 프롬프트/UI 순서에 반영하는 것(지금은 coverage 상태 disclosure만).
- 새 50문항 재감사로 §11의 "전체 적합 응답 수 증가·회귀 없음" 기준을 실제로 검증 — 이건 여전히 사람이 실제 LLM으로 50문항을 다시 돌리고 채점해야 하는, 자동화 안 되는 항목이다.
- `refusal`/`source_excerpts` route는 의도적으로 확장 대상에서 제외했다 — 전자는 애초에 답을 안 한 상태, 후자는 이미 저하된 verbatim fallback이라 facet coverage disclosure가 추가 정보를 주지 않는다고 판단.
