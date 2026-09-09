# 파생 의미 레이어 설계

적용 대상: 검색·라우팅·답변 조립 계층
활성 의미 오버레이 계약: `0.3.0`
활성 한국어 presentation 계약: `0.2.0`
활성 public answer contract: `2.5.0`
현재 상태: 6개 문서 전체에 걸쳐 완전히 구현·검증·서빙 중 — 55개 manifest, 적용 가능한 summary_spec 50개 전부 한국어 presentation entry 보유(gap 0건), 라우트별 표현 계약(§7)까지 활성. 정확한 현재 수치는 `docs/verification_status.md`, 이력은 `history/milestones/derived_semantic_layer_stages_a_g_2026-09-08.md` 참조.

## 1. 목적

현재 코어 데이터는 문서, 섹션, source unit, knowledge record, 정량 기준, 조건 및 상호참조를 원문 추적 가능하게 보존한다. 이 구조는 정확한 근거 회수에는 적합하지만, 사용자가 넓은 질문을 했을 때 다음 작업을 안정적으로 수행하기에는 정보가 부족하다.

- 섹션이나 문서 전체를 먼저 개괄한다.
- 한 주제의 하위 항목을 빠짐없이 묶는다.
- 절차와 조건의 선후·종속 관계를 설명한다.
- 여러 문서 또는 개념을 같은 비교 축에 맞춘다.
- 첫 화면에 보여 줄 핵심과 세부 근거를 구분한다.

파생 의미 레이어는 이 다섯 작업을 지원하는 폐기·재생성 가능한 오버레이이다. 원문이나 규제 요건을 대체하지 않으며, 규제 적합성 판단이나 연구 설계 권고를 생성하지 않는다.

### 진단

코어 데이터가 원문 보존 관점에서 덜 구조화된 것은 아니다. 부족한 것은 **답변 계획용 의미 projection**이다. 현재 record를 더 크게 합치거나 코어에 요약문을 넣으면 추적성과 권위 경계가 약해진다. 따라서 코어 구조는 유지하고, 다음 정보를 별도 파생층에서 보완하는 것이 적절하다.

- `synopsis`: 넓은 질문에 먼저 제시할 범위 지도
- `coverage`: 답변이 다뤄야 할 하위 항목과 조건 분기
- `relation`: 절차, 조건, 예외 사이의 연결
- `comparison axis`: 서로 다른 문서를 같은 기준으로 정렬하는 축
- `salience`: 질문 문맥별 노출 우선순위

## 2. 설계 원칙

1. **코어 우선**: 충돌 시 코어 데이터와 원문이 항상 우선한다.
2. **양방향 추적성**: 모든 파생 객체와 한국어 문장 단위는 기존 record와 source unit으로 역추적되어야 한다.
3. **의미와 표현의 분리**: 주제 구조·관계·coverage는 언어 중립 의미 오버레이에, 한국어 개괄 문장은 별도 presentation 오버레이에 둔다.
4. **질문 비종속성**: 개별 질문과 답변을 저장하지 않고, 여러 질문에서 재사용할 수 있는 주제·관계·비교 축을 저장한다.
5. **비결정 엔진**: 규제 적용 여부, 적합/부적합, Go/No-Go, 권장 설계를 파생 필드로 만들지 않는다.
6. **보수적 실패**: 근거가 오래되거나 coverage가 불완전하면 해당 객체를 사용하지 않고 누락 또는 모호성을 답변에 드러낸다.
7. **점수 배제**: 의미 중요도나 신뢰도를 임의의 숫자로 표현하지 않는다. 제한된 등급과 검토 상태만 사용한다.

## 3. 계층과 저장 위치

```text
원문 PDF
  -> 코어 guideline bundle                         최상위 권위
      -> 구조 의미 오버레이                        파생·언어 중립
          -> 한국어 의미 presentation 오버레이    파생·언어 종속
              -> 검색/라우팅/답변 조립/UI          실행 시 소비
```

제안 위치는 다음과 같다.

```text
data/
  derived/semantic/<document_id>.json
  derived/presentation/ko/<document_id>.json
  ontology/semantic_concepts.json
  schemas/derived_semantic_overlay.schema.json
  schemas/derived_semantic_presentation.schema.json
```

한국어 presentation 오버레이는 `data/presentation/ko/semantic/`이 아니라 `data/derived/presentation/ko/`에 둔다. `data/presentation/ko/`는 기존 `ko_presentation_overlay` 검증기(`validation/validate_ko_presentation.js`)가 하위 디렉터리까지 재귀적으로 스캔하며 `normalized_ko` 계약을 강제하므로, 그 아래에 다른 계약의 파일을 두면 기존 검증기가 오탐한다. 파생 의미 레이어의 두 산출물(구조 오버레이·presentation 오버레이)을 모두 `data/derived/` 아래에 두어 원문 계층과 분리를 명확히 한다.

`data/ontology/semantic_concepts.json`에는 문서 사이에서 재사용하는 topic concept와 comparison axis만 둔다. 문서별 membership과 근거는 각 문서 오버레이에 둔다. 기존 guideline bundle이나 `normalized_ko`에는 이 정보를 역기입하지 않는다.

## 4. 의미 오버레이의 여섯 객체

문서별 의미 오버레이의 최상위 계약은 다음 필드로 제한한다.

- `semantic_overlay_version`
- `document_id`
- `source_bundle_sha256`: RFC 8785 JSON Canonicalization Scheme으로 직렬화한 source bundle UTF-8 bytes의 SHA-256 fingerprint
- `derivation`: `method`(`manual` 또는 `agent_assisted`)과 `pipeline_version`
- `summary_specs`
- `facets`
- `relations`
- `coverage_manifests`
- `comparison_bindings`
- `salience_profiles`

`source_bundle_sha256`는 캐시 무효화와 전체 stale 경고에 사용하고, 실제 객체 사용 가능 여부는 아래 문장·객체별 근거 hash로 다시 판단한다. 배열이 비어 있어도 최상위 필드는 생략하지 않는다.

| 객체 | 해결하는 문제 | 핵심 내용 |
| --- | --- | --- |
| `summary_specs` | 포괄 질문의 개괄 부재 | 요약 대상, 포함할 facet, 문장 역할 |
| `facets` | 관련 chunk의 단순 나열 | 주제의 하위 항목과 근거 membership |
| `relations` | 순서·조건·예외 단절 | record/facet 사이의 방향 관계 |
| `coverage_manifests` | 답변의 항목 누락 | 질문 범위별 기대 facet 집합과 분기 |
| `comparison_bindings` | 비교 축 불일치 | 공통 axis와 문서별 근거의 연결 |
| `salience_profiles` | 모든 근거가 같은 무게로 노출 | 문맥별 primary/supporting/detail 순서 |

### 4.1 공통 근거 참조

모든 객체는 필요한 곳에서 다음 형태의 `evidence_refs`를 사용한다.

```json
{
  "record_id": "<existing knowledge_record id>",
  "source_unit_id": "<existing source_unit id>",
  "source_text_sha256": "<exact knowledge record source_text UTF-8 SHA-256>"
}
```

- 두 ID는 같은 문서에 존재하고 서로 도달 가능해야 한다.
- hash가 현재 record와 다르면 해당 참조와 이를 사용하는 객체는 `stale`이다.
- 문서별 오버레이의 근거는 모두 해당 `document_id`에 속해야 한다. 문서 간 비교는 공통 axis를 통해 실행 시 결합한다.
- 근거 없이 사람이 작성한 설명이나 모델 추론만으로 객체를 만들 수 없다.

### 4.2 `summary_specs`

개괄문의 구조만 정의하며 실제 한국어 문장은 presentation 오버레이에 둔다.

필수 필드:

- `summary_id`: 안정적인 ID
- `target`: `document`, `section`, `facet` 중 하나와 대상 ID
- `summary_kind`: `scope`, `section_overview`, `topic_overview`, `process_overview`
- `facet_ids`: 개괄문이 다뤄야 하는 facet 목록
- `sentence_roles`: `definition`, `scope`, `main_points`, `boundary`, `exception`의 순서 목록
- `evidence_refs`
- `review_status`: 코어 모델과 같은 `unreviewed`, `needs_review`, `reviewed`

`summary_specs`는 완결된 답변이 아니다. 답변 조립 시 첫 문단의 지도 역할을 하며, 뒤따르는 상세 근거의 범위를 제한한다.

### 4.3 `facets`

한 주제에서 사용자가 기대하는 의미 단위를 표현한다. 예를 들어 validation이라는 큰 주제 아래 `types`, `parameters`, `acceptance`, `exceptions`를 둘 수 있지만, 실제 facet은 원문 구조와 근거가 확인된 경우에만 생성한다.

필수 필드:

- `facet_id`
- `concept_id`: 공통 ontology concept 또는 문서 로컬 concept
- `scope`: 연결된 document/section ID
- `parent_facet_id`: 최상위이면 `null`
- `member_record_ids`
- `coverage_basis`: `declared_members` 또는 `section_census`
- `semantic_role`: `definition`, `purpose`, `scope`, `criterion`, `condition`, `exception`, `procedure_step`, `risk_factor`, `evidence`, `boundary` 중 하나
- `review_status`

facet은 규제 요건을 선언하지 않는다. `semantic_role: criterion`은 record의 문서상 역할을 나타낼 뿐 `must`로 승격하지 않는다.

`coverage_basis`는 coverage 상태의 유효 분모를 명시한다. `declared_members`는 선언된 `member_record_ids`만을 유효 분모로 사용하고, `section_census`는 facet scope의 section 구조를 유효 분모로 사용한다. 하위 section이 있는 chapter에 직접 귀속된 본문 record도 존재하면 그 parent 본문을 하나의 section bucket으로 포함한다. 실행 결과의 `effective`가 이 유효 분모이며, `status`는 오직 `effective`로 계산한다. `exact`와 `section`은 진단용 보조 신호로 함께 남지만 서로를 암묵적으로 대체하지 않는다.

### 4.4 `relations`

허용 관계는 닫힌 enum으로 시작하고 필요할 때 스키마 변경으로 확장한다.

- 절차: `precedes`, `follows`, `triggers`
- 조건: `conditioned_by`, `qualifies`, `exception_to`
- 구조: `part_of`, `supports`
- 대조: `contrasts_with`, `alternative_to`, `corresponds_to`

각 관계에는 `from_ref`, `to_ref`, `relation_type`, `evidence_refs`, `review_status`가 필요하다. 원문이 방향을 지지하지 않으면 무방향 관계로 완화하지 말고 `needs_review`로 둔다.

### 4.5 `coverage_manifests`

coverage manifest는 “규제상 필수 항목”이 아니라 “이 범위의 답변이 설명상 완결되기 위해 필요한 의미 항목”을 정의한다. 혼동 방지를 위해 필드명에 `requirement`를 사용하지 않는다.

필수 필드:

- `manifest_id`
- `target`: document, section 또는 facet
- `answer_intent`: `document_overview`, `section_overview`, `topic_overview`, `multi_criterion`, `process`, `comparison`
- `scope_selectors`: 기존 context slot 값만 사용
- `coverage_groups`
- `review_status`

각 `coverage_group`은 다음을 가진다.

- `group_id`
- `selection`: `all`, `one_of`, `one_or_more`
- `facet_ids`
- `when`: molecule, assay, study context 등 이미 구조화된 조건
- `on_ambiguity`: `present_branches`, `ask_context`, `disclose_gap`
- `display_order`

예를 들어 분석 기술에 따라 서로 다른 하위 항목이 존재하지만 질문에 기술이 명시되지 않은 경우, `present_branches`는 한쪽 결과를 임의로 선택하지 않고 두 분기를 먼저 보여 주게 한다.

실행 시 결과는 `complete`, `partial`, `unavailable`, `ambiguous` 중 하나로 계산한다. 이 상태는 저장된 규제 판단이 아니라 현재 검색 결과의 설명 coverage이다.

### 4.6 `comparison_bindings`

문서 A와 문서 B의 pair를 질문별로 저장하지 않는다. 공통 comparison axis를 ontology에 한 번 정의하고, 각 문서의 facet을 그 축에 연결한다.

초기 axis 범주:

- `scope.product_or_matrix`
- `scope.study_stage`
- `validation.type`
- `validation.trigger`
- `validation.extent`
- `criterion.threshold`
- `procedure.sequence`
- `dose.total`
- `dose.frequency`
- `evidence.level`

각 binding은 `axis_id`, `facet_id`, `evidence_refs`, `display_label_key`, `review_status`를 가진다. 비교 답변은 양쪽에서 같은 axis의 binding이 있을 때만 해당 행을 만든다. 한쪽 근거가 없으면 빈칸을 추론으로 채우지 않고 `해당 자료에서 구조화되지 않음`으로 표시한다.

### 4.7 `salience_profiles`

중요도는 질문 문맥에 따라 달라지므로 facet 자체의 전역 점수로 저장하지 않는다.

필수 필드:

- `profile_id`
- `target_id`
- `context`: `document_overview`, `section_overview`, `topic_overview`, `process`, `comparison`, `detail`
- `items`: `facet_id`, `tier`, `display_order`, `rationale_code`

`tier`는 `primary`, `supporting`, `detail`만 허용한다. `rationale_code`는 `scope_boundary`, `definition`, `governing_text`, `exception`, `quantitative_criterion`, `example` 등 검증 가능한 사유를 사용한다. 숫자 중요도나 모델 confidence는 저장하지 않는다.

`review_status`: 다른 다섯 객체와 같은 `unreviewed`/`needs_review`/`reviewed` 삼단계(계약 `0.3.0`부터 필수 필드).

## 5. 한국어 의미 presentation 오버레이

이 레이어는 `summary_specs`와 facet에 대응하는 사용자용 한국어 문장을 보관한다. 기존 `normalized_ko`를 대체하지 않는다. `normalized_ko`가 원문 단위의 의미 보존 번역이라면, 이 레이어의 문장은 여러 근거를 종합한 표시용 설명이다.

각 entry의 필수 필드:

- `semantic_id`: 의미 오버레이 객체 ID
- `language`: `ko`
- `units`: 순서가 있는 문장 단위 목록
- `review_status`

각 unit의 필수 필드:

- `unit_id`
- `text`
- `sentence_role`
- `evidence_refs`
- `source_support`: `direct` 또는 `synthesized`

`synthesized`는 복수 근거를 압축했다는 뜻이며 해석 권위가 높다는 뜻이 아니다. 모든 문장에 독립적인 근거 목록이 있어야 한다. 하나의 문장이 서로 다른 문서의 근거를 섞는 경우 문서별 절로 분리한다.

새로 생성된 synthesized 문장은 `needs_review`로 시작한다. `unreviewed`는 아직 의미 검토를 시작하지 않은 수동 초안에만 사용하며, 실행 계층은 `reviewed` entry만 소비한다.

## 6. 답변 엔진 소비 절차

1. 기존 router가 문서, 주제, context slot 및 answer intent를 정하고, 이미 성립하는 detail·single-criterion·composite/list 경로를 우선 처리한다.
2. 기존 경로가 답을 만들지 못하거나 incidental detail로 축소될 때만, reviewed + fresh + evidence-bearing coverage manifest를 broad-question routing fallback 후보로 사용한다. 명시된 문서·section·topic, 호환 answer intent, 회수 근거와의 거리를 사용하며 record 수나 section 크기는 순위에 쓰지 않는다. 서로 다른 target이 동률이면 선택하지 않는다.
3. 각 facet의 member record를 검색 후보에 포함하고 기존 검색 순위와 source authority를 적용한다.
4. relation graph로 절차, 조건, 예외 및 대조의 표시 순서를 정한다.
5. 최신이며 reviewed인 summary presentation이 있으면 생성형 답변의 도입부로 사용한다.
6. 비교 질문은 공통 comparison axis별로 양쪽 binding을 정렬한다.
7. salience profile에 따라 첫 답변과 펼침 가능한 세부 근거를 나눈다.
8. 선택된 reviewed manifest에서 최소 한 facet이 실제 근거에 grounded된 경우에만 partial structured 응답을 허용한다. 적용 가능한 모든 facet을 manifest와 대조해 coverage 상태와 빠진 항목을 응답 metadata에 기록한다.
9. 기존 인용 검증을 통과한 문장과 근거만 UI에 표시한다.

오버레이가 없거나 stale/unreviewed이거나, 선택된 manifest의 어떤 facet도 실제 근거에 grounded되지 않으면 현재 코어 검색으로 안전하게 fallback하거나 abstain한다. reviewed manifest의 존재만으로 API route를 강제하지 않는다.

## 7. 라우트별 표현 계약

파생 의미 레이어는 라우팅을 대체하지 않고 라우트별 표현 차이를 강화한다.

| 라우트/intent | 첫 화면 | 아래 근거 영역 |
| --- | --- | --- |
| 직접 근거·좁은 detail | 핵심 문장 또는 정량 기준 | 원문 record, 조건, 예외 |
| section/topic overview | 한 개의 개괄 박스 | manifest facet별 섹션 카드 |
| process | 목적과 전체 흐름 | relation 순서의 단계 카드 |
| comparison | 비교 범위 설명 | 공통 axis 행 단위 비교 |
| API 생성 route | 근거가 연결된 자연어 종합 박스 | 가이드라인/섹션 헤더별 구조 근거 |

모든 근거 그룹의 첫 헤더는 `가이드라인 제목 > 섹션 경로`를 표시한다. 그 아래에 facet label과 원문/한국어 표현을 둔다. 동일 섹션의 중복 헤더는 합치되 서로 다른 가이드라인의 근거는 한 카드에 섞지 않는다.

## 8. 검증 규칙

### 8.1 결정적 검사

- 두 오버레이가 각각 JSON Schema를 통과한다.
- 모든 ID가 해당 namespace에서 유일하다.
- document, section, record, source unit, facet 및 concept 참조가 해소된다.
- `evidence_refs`의 record와 source unit 연결이 코어 데이터와 일치한다.
- 저장된 hash가 현재 source text hash와 일치한다.
- facet parent graph와 절차 관계에 허용되지 않은 cycle이 없다.
- manifest의 facet ID가 존재하며 group 안에서 중복되지 않는다.
- comparison binding의 axis가 ontology에 존재한다.
- 같은 profile/context/tier 안의 `display_order`가 유일하다.
- 모든 presentation 문장에 한 개 이상의 evidence ref가 있다.

### 8.2 의미 검사

- 파생 문장이 근거가 지지하지 않는 수치, 조건, 예외 또는 적용 범위를 추가하지 않는다.
- `must`, `should`, `may` 등 규제 강도를 원문보다 강화하지 않는다.
- 개괄문이 manifest의 primary facet을 빠뜨리거나 detail 예시만 대표 항목으로 승격하지 않는다.
- 관계의 방향과 조건이 근거에 포함되어 있다.
- 비교 행의 양쪽 내용이 동일 axis에 답하고 있다.
- `normalized_ko`와 presentation 요약을 서로의 대체물로 취급하지 않는다.

의미 검사는 agent 검토를 사용할 수 있지만, 결과와 근거를 저장하고 `needs_review`에서 `reviewed`로의 전이는 별도 검증 단계에서만 수행한다.

## 9. 금지 필드와 비목표

다음은 파생 의미 레이어에 저장하지 않는다.

- 개별 사용자 질문 또는 질문별 완성 답변
- 환자·프로그램별 규제 적용 결론
- 적합성, 승인 가능성, Go/No-Go 판단
- 근거 없는 best practice나 연구 설계 권고
- 임의의 신뢰도·품질·중요도 숫자 점수
- 검색 embedding 또는 검색 순위 자체
- 원문에 없는 `must`/`required` 승격
- 기존 코어 record의 대체 사본

이 설계는 과거에 검토 후 폐기된 effective-state 또는 amendment merge 모델을 되살리지 않는다. 문서 버전 간 법적·규제적 유효 상태를 계산하지 않으며, 현재 bundle의 근거를 설명하기 위한 의미 topology만 제공한다.

## 10. 운영: 저작·검증·승격

이 레이어를 구성하는 6개 문서 오버레이는 모두 완전히 구현·서빙되고 있다. 새 문서를 추가하거나 기존 범위를 넓힐 때 쓰는 현재 도구는 다음과 같다 — 모두 `npm run <script>`로 실행하며, 각 스크립트 자신의 파일 상단 주석에 정확한 사용법이 있다.

| 계층 | 저작(build/author) | 오프라인 검증(audit) | 결정적 검증(verify) | 승격(promote) |
| --- | --- | --- | --- | --- |
| `facets`/`coverage_manifests`/`comparison_bindings` | `build:semantic:manifests`(문서별 section 구조를 손으로 설정한 뒤 실행 — 완전 자동 생성 아님) | `audit:semantic:manifests` | `verify:semantic:manifests` | 개별 promote 스크립트 없음 — `check:promotion`으로 활성화 기준(§11) 진행 상태를 확인 |
| `summary_specs`/`salience_profiles` | `build:semantic:summaries`(위 manifest 중 아직 없는 것에 기계적으로 구조만 생성, 한국어 문장은 생성하지 않음) | `audit:semantic:summaries` | `validate:semantic` | `promote:semantic:summaries` |
| 한국어 presentation (`data/derived/presentation/ko/`) | `author:semantic:presentation --document <id>`(LLM 저작 + 독립 검증 모델로 즉시 entailment 검증) | `audit:semantic:presentation` | `validate:semantic` | `promote:semantic:presentation` |

승격(promote) 스크립트는 공통 lifecycle(`scripts/semantic_promotion_lifecycle.js`)을 쓴다: `prepare`(needs_review → reviewed 반영, receipt 기록) → 별도 명령으로 실 서비스 상태에 대해 live 50문항 감사 실행 → `verify`(감사의 fingerprint가 prepare 시점 상태와 정확히 일치해야 통과, 그렇지 않으면 stale로 거부) → 성공 시 finalize, 실패 시 이번 promotion만 자동 rollback. 인자 없이 실행하면 prepare+verify를 한 번에 수행(하위 호환 기본 동작); `--prepare`/`--verify`/`--rollback`으로 단계를 분리할 수 있다.

established-16-suitable-case 회귀 정책은 route별로 다르다: `structured` 등 결정적 route는 claim 집합 완전 일치를 요구하고, `grounded_generation`(16개 중 10개)은 route/mode/`answered`/grounding 유효성만 요구하며 claim 선택 차이는 회귀가 아니라 진단으로만 기록한다 — 근거는 `history/decision_log/review_log.md` REV-015.

각 스크립트가 정확히 무엇을 하는지, 어떤 데이터에 하드코딩된 문서별 설정이 있는지는 스크립트 자신의 헤더 주석을 신뢰할 것 — 이 표는 어떤 명령을 언제 쓰는지 안내할 뿐이다. 이 레이어가 현재 형태로 만들어진 경위(Stage A부터 G까지의 실제 구현·검증 서술)는 `history/milestones/derived_semantic_layer_stages_a_g_2026-09-08.md`에 있다.

## 11. 활성화 승인 기준

- 신규 schema와 참조 validator가 모두 통과한다.
- stale 객체가 자동으로 제외된다.
- 50문항 감사에서 부적합 응답 수가 감소하고 기존 적합 응답이 회귀하지 않는다.
- overview 질문은 개괄문과 manifest의 primary facet을 모두 포함한다.
- 다중 기준 질문은 누락된 coverage group을 숨기지 않는다.
- 조건이 모호한 질문은 임의의 한 분기 대신 분기 제시 또는 확인 질문을 사용한다.
- comparison 질문은 같은 axis만 한 행에서 비교한다.
- 각 생성 문장과 UI 근거 카드가 document, section, record/source unit으로 추적된다.

전부 충족되어 현재 활성 상태다. 판정 근거와 승인 경위는 `history/milestones/derived_semantic_layer_stages_a_g_2026-09-08.md`를 참조.
