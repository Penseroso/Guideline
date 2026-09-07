# 50문항 답변 적합성 재감사 — Stage C 활성화 후

감사 기간: 2026-09-03 (Stage C full 확장 직후)

질문 원문과 최소 계약: `docs/answer_suitability_evaluation.md`

비교 기준(직전 감사): `history/verification/answer_suitability_audit_2026-09-02.md` (구현 후 16 적합 / 29 부분 적합 / 5 부적합)

실행 방식: 실제 로컬 HTTP 서버의 `POST /api/ask`, 한국어 응답, 자동 route, API 생성/검증 허용 (`generation_preference: "auto"`)

생성/검증: `openai/gpt-5.6-terra` → `openai/gpt-5.6-sol`

## 1. 실행 무결성

- 전체 50문항 실행 원본: `logs/runtime/answer_suitability_50_raw_2026-09-03_stagec.json`.
- 최초 실행에서 Q21, Q26이 `no-valid-envelope` 오류(HTTP 타임아웃 근처, 각각 52.8s/21.9s)로 실패했다. 오류 항목을 결과에서 제외한 뒤 `GUIDELINE_AUDIT_IDS=Q21,Q26`로 재실행해 두 문항 모두 유효 envelope를 받았다. 최종 50/50 완료, 오류 0건.
- 평가는 자동 채점기가 아니라 `docs/answer_suitability_evaluation.md`의 문항별 최소 계약·7차원 채점 기준·치명적 실패 목록을 기준으로, 각 envelope의 `prose`/`claims`/`coverage`/`semantic_coverage`/route·mode를 에이전트가 직접 판독했다(2026-09-02 감사와 동일한 방식). 브라우저 렌더링 재확인은 이번 재감사에서는 수행하지 않았다 — Stage C의 `semantic_coverage` UI 렌더링 자체는 `history/verification/semantic_stage_c_pilot_2026-09-03.md`에서 이미 별도로 브라우저·실 API로 검증되었다.

## 2. 결과

| 판정 | 문항 수 | 비율 | 직전 감사 |
|---|---:|---:|---:|
| 적합 | 15 | 30% | 16 |
| 부분 적합 | 33 | 66% | 29 |
| 부적합 | 2 | 4% | 5 |

route/mode 분포:

| route / mode | 이번 | 직전 |
|---|---:|---:|
| `grounded_generation / generated` | 32 | 29 |
| `structured / section_overview` | 9 | 9 |
| `structured / structured` | 2 | 3 |
| `structured / list` | 1 | 2 |
| `structured / multi_criterion` | 2 | 2 |
| `structured / process` | 1 | 2 |
| `structured / document_overview` | 1 | 1 |
| `structured / within_document_comparison` | 1 | 1 |
| `structured / comparison` | 1 | 1 |

5문항(Q15, Q26, Q31, Q46, Q50)의 route/mode가 직전 감사와 달라졌다 — LLM 기반 자동 라우팅의 실행별 변동이며 Stage C 자체는 route 선택 로직을 건드리지 않는다(disclosure-only 설계).

**§11 기준 3("50문항 감사에서 전체 적합 응답 수가 증가하고 기존 적합 응답이 회귀하지 않는다") 판정: 미충족.** 부적합이 5건→2건으로 크게 줄었지만, 적합 총수는 16→15로 오히려 감소했고 기존 적합 문항 중 Q45가 부분 적합으로 회귀했다(§4 참조). 나머지 15개 기존 적합 문항은 전부 회귀 없이 유지됐다.

## 3. 원 부적합 5문항 — Stage C 전/후 비교

| ID | 이전 | 현재 | 핵심 변화 |
|---|---|---|---|
| Q06 | 부적합 | **부분 적합** | route 동일(`structured/multi_criterion`). Run-acceptance 답변에서 chromatography/LBA를 여전히 구분 없이 섞어 제시하던 것과 달리, 이번에는 `semantic_coverage`가 `run_acceptance` manifest를 `status:"ambiguous"`로 판정하고 `chromatography_branch`(4/6)·`lba_branch`(1/6) 두 분기를 각각 `partial`로 명시 disclosure한다(`on_ambiguity:"present_branches"`). 원 감사가 요구한 "기술 범위 확인 또는 분기 답변"이 정확히 구현됐다. 단, §3.3.2의 QC 2/3·수준별 50% acceptance 분모 자체는 여전히 답변 본문에 없다 — 콘텐츠 결함은 그대로이나 이제는 그 결함이 사용자에게 명시적으로 disclosure된다.
| Q15 | 부적합 | **부분 적합** | route 변경(`structured/list`→`grounded_generation/generated`). Confirmatory/titration/neutralization 근거가 섞이던 원 결함은 사라졌다(현재 답변은 general+screening 항목만 다룬다). 그러나 drug_tolerance·specificity는 여전히 값 없이 누락되어 있다 — `semantic_coverage`가 `screening_performance` manifest에서 이 둘을 `"missing"`으로, cut_point/sensitivity/precision을 `"partial"`으로 정확히 disclosure한다.
| Q20 | 부적합 | **부적합 (미개선)** | route 동일(`grounded_generation/generated`). 답변이 여전히 "환자별 요인, 제품별 특성"만 이름만 언급하고 곧바로 임상적 결과(아나필락시스/CRS/ADA 발생률 영향요인)로 이동한다 — 원 결함 그대로. 더 근본적으로, 이 envelope에는 `semantic_coverage`가 **아예 붙지 않았다**. 원인을 추적하니 검색된 근거 섹션이 `fda_ada_2014.sec.6`(결론)·`fda_ada.sec.3_b`(안전성 결과) 등 실제 위험요인 절(§V.A/§V.B)이 아닌 임상결과 절이라 — 검색 단계 자체가 잘못된 절에서 근거를 가져오고 있어 disclosure를 계산할 section 교집합이 없다. Q21(같은 위험요인 주제, 올바른 §V.A~B 절을 검색)에서는 동일 manifest가 정확히 발동하는 것과 대조된다. Stage C 이전과 동일한 근본 검색 결함이 그대로 남아 있고, 이번 확장이 우연히도 이 결함을 disclosure할 기회조차 잡지 못했다.
| Q26 | 부적합 | **부분 적합** | route 변경(`structured/list`→`grounded_generation/generated`). 답변은 여전히 dose-selection 계산(NOAEL/MABEL/PAD/안전계수)에만 좁게 머문다 — 원 결함 그대로. 그러나 `semantic_coverage`가 `document_overview` manifest에서 `scope`/`quality`/`non_clinical`/`trial_planning`을 전부 `"missing"`으로, `dose_selection`을 `"partial"`(2/7)로 정확히 disclosure한다 — 원 감사가 지목한 누락 영역과 정확히 일치한다.
| Q49 | 부적합 | **부적합 (미개선)** | route 동일(`structured/comparison`). M3(R2) 쪽 답변이 여전히 "적용된다." 한 단어로 잘려 있다 — 원 감사가 지목한 저맥락 정규화 결함 그대로. `semantic_coverage`의 comparison 축 disclosure는 `both_sides_evidenced:true`와 양쪽 모두 `"partial"`이라는 일반적 문구만 보여줄 뿐("일부 세부 항목이 빠졌을 수 있습니다"), M3 쪽 텍스트가 사실상 무정보 상태라는 구체적 문제를 짚어주지 못한다 — 이 disclosure는 대칭적 "약간 불완전" 인상을 주어 오히려 실제 결함의 심각도를 가릴 위험이 있다.

**요약**: 5개 중 3개(Q06/Q15/Q26)는 Stage C의 disclosure 메커니즘이 원 감사가 지목한 결함을 정확히 표면화해 부분 적합으로 개선됐다. 2개(Q20/Q49)는 근본 콘텐츠 결함이 그대로이고, disclosure도 각각 "아예 발동 안 함"(Q20 검색 단계 결함) / "발동은 하지만 문제의 본질을 짚지 못함"(Q49) 이유로 부적합에 머물렀다.

## 4. 발견된 회귀 — Q45 (적합 → 부분 적합)

- 최소 계약: "사용 목적, 전제조건, 한계와 해석상 주의를 분리한다. 사용 권고나 적합성 결론을 만들지 않는다."
- 직전 감사: 적합 — "relevant species 부재, homologous/transgenic 대안, 목적과 정량 위험평가 한계를 분리한다."
- 이번 답변(전문): "어떤 종에서도 biopharmaceutical이 orthologous target과 상호작용하지 않아 relevant species를 확인할 수 없을 때, homologous molecule의 사용을 고려할 수 있습니다. relevant species가 없을 때, human receptor를 발현하는 relevant transgenic animal의 사용 또는 homologous protein의 사용을 고려해야 합니다." (claims 2건)
- 원문(S6(R1) §2.3, Q43 감사에서 확인됨)은 "homologous protein 연구는 hazard detection에는 쓰일 수 있으나 정량적 위험평가에는 일반적으로 유용하지 않다"는 한계를 명시하는데, Q45의 현재 답변에는 이 정량적 위험평가 한계 문장이 전혀 없다 — 대안 존재만 말하고 그 한계는 빠졌다. 원 감사가 적합 판정의 근거로 명시한 요소가 이번 실행에서 누락됐다.
- Stage C disclosure(`semantic_coverage`)는 S6(R1)에 대한 승격된 manifest가 없어 이 문항에는 애초에 붙지 않는다 — 즉 이 회귀는 Stage C의 직접적 부작용이 아니라 생성 라우팅의 실행 변동(같은 질문, 같은 route, 다른 실행에서 더 짧은 답변)으로 보인다. 원인이 Stage C 코드 변경인지 순수 LLM 샘플링 변동인지는 이번 재감사만으로 단정할 수 없다 — 근본 원인 확인이 필요하다.

**후속 확인 결과 (2026-09-03, 원인 확정)**: `logs/runtime/answer_suitability_50_raw_2026-09-03_stagec.json`의 Q45 envelope를 직접 확인한 결과, `coverage.claim_count`는 3(라우터가 찾은 후보 근거 수)인데 `coverage.generated_claim_count`/`claims.length`는 2다 — 즉 라우터는 정량적 위험평가 한계 레코드(`ich_s6_r1.kr.part2_2_3.002`, 섹션 `ich_s6_r1.sec.part2.2_3`)가 포함된 올바른 섹션을 정확히 찾아 후보로 넘겼지만(`scope.section_ids`에 해당 섹션 포함), grounded_generation의 LLM 생성 단계가 그 후보 3개 중 2개만 골라 서술에 반영했다. 또한 `engine/answer_envelope.js`에서 `envelope.semantic_coverage = safeReviewedSemanticCoverage(...)` 호출은 `generated.claims`/`generated.text`가 이미 확정된 **이후**에 실행되며 그 값을 읽기만 할 뿐 되돌려 쓰지 않는다 — Stage C 코드는 구조적으로 claim 선택이나 prose 생성에 관여할 수 없다. 두 사실을 종합하면 이 회귀는 Stage C 코드 변경과 무관하며, LLM가 동일한 후보 근거 집합에서 서술에 포함할 근거를 고르는 생성 단계 자체의 실행별 변동이다 — §11 기준 3의 "회귀"가 Stage C 탓은 아니라고 결론 내린다. 다만 이 생성-측 근거 선택 변동 자체는 Stage C와 별개로 존재해 온 위험이며, 근본적 완화책(예: 후보 근거를 모두 인용하도록 강제하거나 최소 인용 수를 강제)은 이번 범위 밖의 별도 과제로 남는다.

## 5. 참고 관찰 (판정 변경 없음, 재확인 권장)

- **Q23** (부분, 불변): 답변이 문장 1개·근거 1건으로 극히 짧아졌다. 핵심 주장(SC가 IV보다 면역원성 높음)은 정확하고 출처가 있어 최소 계약은 만족하지만, dose/frequency 축은 완전히 사라졌다 — 직전 감사의 "축이 부족하다"보다 더 얇아진 상태. 판정 유지에는 문제 없으나 내용 빈약화 추세는 주시할 필요.
- **Q21, Q27, Q28, Q31, Q46**: 이번 실행의 `prose`만 놓고 보면 직전 감사가 지목한 약점(비교축 비대칭, 저맥락 synopsis, 운영흐름 부족, PK/PD 해석 논리 부족)이 상당히 개선된 것처럼 읽힌다. 다만 이 판독은 감사 스크립트가 만드는 `envelope.prose`(모든 route에 존재하는 텍스트 표현)에 기반하며, 실제 화면에 렌더링되는 `answer_units`/구조화 카드와 완전히 동일한 형태인지는 이번 재감사에서 브라우저로 재확인하지 않았다. 원 감사와 동일한 근거(같은 텍스트 표현)로 판독했다는 확신이 없어 판정을 보수적으로 직전 감사와 동일하게 유지했다 — 실제로는 더 나을 수 있다.

## 6. 문항별 판정 전체 표

| ID | 이전 | 현재 | 비고 |
|---|---|---|---|
| Q01 | 부분 | 부분 | 불변 |
| Q02 | 적합 | 적합 | 불변 |
| Q03 | 적합 | 적합 | 불변 |
| Q04 | 적합 | 적합 | 불변 |
| Q05 | 부분 | 부분 | 불변 |
| Q06 | 부적합 | **부분** | 개선 — §3 참조 |
| Q07 | 부분 | 부분 | 불변 |
| Q08 | 적합 | 적합 | 불변 |
| Q09 | 적합 | 적합 | 불변 |
| Q10 | 부분 | 부분 | 불변 |
| Q11 | 부분 | 부분 | 불변 |
| Q12 | 적합 | 적합 | 불변 |
| Q13 | 부분 | 부분 | 불변 |
| Q14 | 적합 | 적합 | 불변 |
| Q15 | 부적합 | **부분** | 개선 — §3 참조 |
| Q16 | 적합 | 적합 | 불변 |
| Q17 | 적합 | 적합 | 불변 |
| Q18 | 부분 | 부분 | 불변 |
| Q19 | 부분 | 부분 | 불변 |
| Q20 | 부적합 | 부적합 | 미개선 — §3 참조 |
| Q21 | 부분 | 부분 | §5 참고 |
| Q22 | 부분 | 부분 | 불변 |
| Q23 | 부분 | 부분 | §5 참고(빈약화) |
| Q24 | 적합 | 적합 | 불변 |
| Q25 | 적합 | 적합 | 불변 |
| Q26 | 부적합 | **부분** | 개선 — §3 참조 |
| Q27 | 부분 | 부분 | §5 참고 |
| Q28 | 부분 | 부분 | §5 참고 |
| Q29 | 적합 | 적합 | 불변 |
| Q30 | 부분 | 부분 | 불변 |
| Q31 | 부분 | 부분 | §5 참고, route 변경 |
| Q32 | 부분 | 부분 | 불변 |
| Q33 | 부분 | 부분 | 불변 |
| Q34 | 부분 | 부분 | 불변 |
| Q35 | 부분 | 부분 | 불변 |
| Q36 | 부분 | 부분 | 불변 |
| Q37 | 부분 | 부분 | 불변 |
| Q38 | 적합 | 적합 | 불변 |
| Q39 | 부분 | 부분 | 불변 |
| Q40 | 부분 | 부분 | 불변 |
| Q41 | 적합 | 적합 | 불변 |
| Q42 | 부분 | 부분 | 불변 |
| Q43 | 적합 | 적합 | 불변 |
| Q44 | 부분 | 부분 | 불변 |
| Q45 | 적합 | **부분** | **회귀 — §4 참조** |
| Q46 | 부분 | 부분 | §5 참고, route 변경 |
| Q47 | 적합 | 적합 | 불변 |
| Q48 | 부분 | 부분 | 불변 |
| Q49 | 부적합 | 부적합 | 미개선 — §3 참조 |
| Q50 | 부분 | 부분 | route 변경, 실질 변화 없음 |

## 7. 결론

Stage C의 disclosure 메커니즘은 설계 의도대로 작동한다 — 검색/생성이 실제로 부분적이거나 모호할 때 그 사실을 사용자에게 명시적으로 알린다(Q06/Q15/Q26). 다만:

1. disclosure는 원인이 아니라 증상만 완화한다 — 5개 원 부적합 문항 중 3개는 부분 적합으로 올라섰지만, 그 문항들의 실제 답변 콘텐츠 결함(QC 분모 누락, drug tolerance 누락, dose-selection 축소)은 하나도 고쳐지지 않았다.
2. Q20은 disclosure가 아예 발동하지 않아 개선 효과를 전혀 못 봤다 — 근본 원인은 검색 단계가 위험요인 절이 아닌 결론/안전성-결과 절에서 근거를 가져오는 기존 엔진 결함이며, Stage C 범위 밖이다.
3. Q49는 disclosure가 발동은 하지만 실제 결함(M3 쪽 텍스트가 사실상 공백)을 짚어내지 못하는 너무 일반적인 문구("일부 세부 항목이 빠졌을 수 있습니다")를 보여준다.
4. Q45에서 기존 적합 문항이 부분 적합으로 회귀했다 — §11 기준 3("적합 수 증가, 기존 적합 회귀 없음")은 엄밀하게 미충족이다.

**권고**: Stage C를 "현재 구현 범위(coverage disclosure)"로 §11 승인하기 전에, (a) Q45 회귀의 원인이 Stage C 코드 변경인지 순수 LLM 변동인지 확인하고, (b) Q20의 검색 단계 결함(잘못된 섹션에서 근거 회수)은 Stage C 밖의 별도 엔진 버그로 이슈화하고, (c) Q49의 disclosure 문구가 "부분"이라는 일반 등급 대신 구체적으로 무엇이 비어있는지("M3 scope 절 정규화가 불완전합니다" 등) 보여주도록 개선을 검토할 것을 권고한다. 이 셋을 해결하지 않고 그대로 §11에 "승인 완료"로 기록하는 것은 근거가 약하다.

## 8. 후속 조치 (2026-09-03, 이어서 수행)

세 권고 항목을 모두 처리했다.

- **(a) Q45 원인 확정** — §4 후속 확인 결과 참조. 라우터는 정량적 위험평가 한계 레코드가 있는 올바른 섹션을 정확히 후보로 찾았으나(`coverage.claim_count: 3`), grounded_generation의 LLM 생성 단계가 그 중 2개만 서술에 반영했다(`generated_claim_count: 2`). `engine/answer_envelope.js`에서 Stage C의 `semantic_coverage` 할당은 `generated.claims`/`generated.text`가 이미 확정된 뒤 읽기 전용으로 실행되므로, 구조적으로 이 회귀에 관여할 수 없다. **결론: Q45 회귀는 Stage C 코드와 무관한, 생성 단계의 실행별 변동이다.**
- **(b) Q20, 이슈화를 넘어 실제로 수정함** — 사용자가 스코프 확대를 지시해(§9 참조) 근본 원인까지 고쳤다. `engine/query_router.js`의 `classifyAnswerIntent`가 "크게"("broadly")를 breadth 신호로 인식하지 못해 이 질문이 `breadth: "detail"`로 분류됐고, 그 결과 `tryCoverageCompositeQuery`(broad 전용)가 실행되지 못한 채 `scoreRecord`가 이미 정확히 찾아낸 두 위험요인 섹션(`5_a_5`, `5_b_6`) 간의 동점을 `structuredQuery`의 Case 4("모호함, 기권")가 그냥 버리고 무자격 vector-store 폴백으로 넘어간 것이 원인이었다. "크게"를 breadth 신호 정규식에 추가해 수정, 전체 337개 테스트 통과(신규 회귀 테스트 1건 포함). 실 서버로 재확인: 이제 §V.A.5(유전자결실 환자)·§V.B.6(제품의 면역조절 기전)·§V.A.1(환자 면역상태) 등 진짜 위험요인 섹션을 인용하고, `semantic_coverage`도 `status:"partial"`(patient 2/5, product 1/9)으로 정확히 발동한다. 자세한 원인·수정 내역은 `history/decision_log/review_log.md` REV-012(Status: Resolved) 참조.
- **(c) Q49, disclosure 개선 + 데이터 자체도 수정** — 두 갈래로 처리했다. 먼저 disclosure: 비교 축이 이제 상태 단어 옆에 실제 커버리지 분수(`exact` 우선, 없으면 `section`)를 표시한다(`web/render.js`의 `coverageFractionLabel`, `web/app.css`의 `.semantic-coverage-fraction`) — 모든 comparison axis 렌더링에 적용되는 구조적 변경. 다음으로 데이터: M3(R2) §1.3의 `normalized_ko`가 주어 없는 서술어 파편("적용된다.", "참조할 것.")이었던 것을 확인해 이 질문이 실제로 쓰는 2개 레코드(`ich_m3_r2.kr.1_3.001`, `.004`)를 S6(R1) 형제 레코드와 같은 완전한 문장으로 재정규화했다(`data/pilots/ich_m3_nonclinical.json`, `data/derived/semantic/ich_m3_r2.json`의 `source_bundle_sha256` 재계산 포함). 사용자는 M3(R2) 전체 60개 레코드 재정규화가 아니라 이 2개만 수정하는 최소 범위를 선택했다 — 나머지는 `history/decision_log/review_log.md` REV-013(Status: Open)에 기록. 단위 테스트 2건 추가, 실 서버로 재확인: M3(R2) 쪽이 이제 "본 지침은 의약품 개발 과정에서 통상적으로 마주치는 상황에 적용된다."라는 완전한 문장으로 나온다. 다만 두 문서를 명시적으로 대조하는 종합 문장은 여전히 없다 — "부적합"에서는 벗어났지만 "적합"이라 보기도 어렵다(§9 재감사에서 재판정).

**§11 기준 3 최종 판정에 대한 남은 쟁점 (이 절 작성 시점 기준, §9에서 갱신됨)**: (a)(b)(c)를 disclosure 범위로만 처리했을 때는 적합 수가 여전히 16→15(Q45 회귀 1건)였고, 5개 원 부적합 중 3개만 부분 적합으로 개선됐을 뿐 적합으로 승격된 문항은 0개였다 — Stage C가 설계상 disclosure-only(§10 각주)라 콘텐츠 결함 자체를 고치지 않기 때문에 구조적으로 그랬다. 하지만 사용자가 "Stage C 스코프에 얽매이지 말고 실제로 고칠 수 있는지"를 물었고(§9), 조사 결과 Q06/Q20/Q26/Q45/Q49 전부 구조적으로 불가능한 게 아니라 각각 구체적인 라우팅 버그·데이터 품질 결함·생성 완결성 문제였다. Q20(라우팅)과 Q49(데이터)는 이번 라운드에서 실제로 고쳤다 — 더 이상 disclosure만이 아니라 콘텐츠 자체가 개선됐다. 이에 따라 §9에서 전체 재감사를 다시 실행해 최신 수치로 §11을 재판정한다.
