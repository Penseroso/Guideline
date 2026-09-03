# 50문항 답변 적합성 및 UI 감사

감사 기간: 2026-09-02~2026-09-03

질문 원문과 최소 계약: `docs/answer_suitability_evaluation.md`

실행 방식: 실제 로컬 HTTP 서버의 `POST /api/ask`, 한국어 응답, 자동 route, API 생성/검증 허용

생성/검증: `openai/gpt-5.6-terra` → `openai/gpt-5.6-sol`

## 1. 실행 무결성

- 최신 전체 실행은 50/50 완료됐고 HTTP/실행 오류는 0건이다.
- 전체 실행 원본은 `logs/runtime/answer_suitability_50_raw_2026-09-03_final.json`이다.
- 마지막 공통 규칙 보정 후 Q01, Q02, Q05, Q29, Q38, Q49를 다시 실행한 결과는 `logs/runtime/answer_suitability_final_overrides.json` 및 `logs/runtime/answer_suitability_Q49_final4.json`이다.
- 운영 `web/render.js`와 `web/i18n.js`로 렌더한 전체 UI는 `logs/runtime/answer_suitability_50_ui_2026-09-03_final.html` 및 문항별 디렉터리에 보관했다.
- 평가는 자동 채점기가 아니라 질문별 최소 계약, 전체 envelope, 인용 원문, route/mode, 실제 renderer 동작을 직접 판독했다.

감사 도중 Q13 외부 생성 호출이 한 차례 HTTP 500으로 실패했다. 감사 스크립트는 오류 envelope에서도 `claims.length`를 읽어 중단되는 결함이 있었으며, 오류를 완료로 간주하지 않는 resume와 안전한 오류 로깅으로 수정했다. 성공한 Q01~Q12는 재호출하지 않고 Q13부터 복구해 50문항을 완료했다.

## 2. 구현 후 결과

| 판정 | 문항 수 | 비율 |
|---|---:|---:|
| 적합 | 16 | 32% |
| 부분 적합 | 29 | 58% |
| 부적합 | 5 | 10% |

최초 감사의 10 적합 / 13 부분 적합 / 27 부적합과 비교하면 부적합이 27건에서 5건으로 감소했다. 최신 합성 실행의 route/mode 분포는 다음과 같다.

| route / mode | 수 |
|---|---:|
| `grounded_generation / generated` | 29 |
| `structured / section_overview` | 9 |
| `structured / structured` | 3 |
| `structured / list` | 2 |
| `structured / multi_criterion` | 2 |
| `structured / process` | 2 |
| `structured / document_overview` | 1 |
| `structured / within_document_comparison` | 1 |
| `structured / comparison` | 1 |
| refusal 또는 source-excerpt fallback | 0 |

## 3. 문항별 최종 판독

| ID | 판정 | 핵심 진단 |
|---|---|---|
| Q01 | 부분 | M10 목적과 9개 주요 장을 회수하지만 간결한 한국어 문서 지도가 부족하다. |
| Q02 | 적합 | M10 §2.2 아래 Full, Partial, Cross Validation을 정확히 분리했다. |
| Q03 | 적합 | LC-MS/MS full validation의 9개 직접 하위 절을 모두 표시한다. |
| Q04 | 적합 | QC 준비와 평가, within/between-run, 농도·반복·run/day 조건을 분리한다. |
| Q05 | 부분 | 일반/LLOQ accuracy·precision 및 5 replicates, 3 runs/2 days를 모두 회수하나 표가 아닌 긴 구조 목록이다. |
| Q06 | 부적합 | chromatography와 LBA가 섞이고 QC 2/3·각 수준 50% acceptance가 잘린다. 기술 범위 확인 또는 분기 답변이 필요하다. |
| Q07 | 부분 | 주요 안정성 유형과 조건을 연결하지만 chromatography/LBA 차이와 장기보관 맥락이 불완전하다. |
| Q08 | 적합 | ISR 목적, 표본선정, 표본비율, chromatography/LBA 판정기준을 순서대로 답한다. |
| Q09 | 적합 | LBA §4.2의 7개 하위 절을 모두 LBA 범위로 제시한다. |
| Q10 | 부분 | partial/cross 근거는 맞지만 같은 비교축의 대칭 UI가 아니다. |
| Q11 | 부분 | multi-tier 흐름은 있으나 titration 역할과 전체 시작 맥락이 약하다. |
| Q12 | 적합 | screening→confirmatory→조건부 titration/NAb 관계가 정확하다. |
| Q13 | 부분 | tiering, sensitivity, matrix, cut point, drug tolerance 등은 포함하지만 robustness와 controls 범주가 부족하다. |
| Q14 | 적합 | FDA ADA §VI.A~E 5개 validation 절을 모두 표시한다. |
| Q15 | 부적합 | screening 성능 질문에 confirmatory/titration/neutralization 근거가 섞이고 필수 성능축 구조가 불완전하다. |
| Q16 | 적합 | screening 양성→특이성 확인→확인 양성의 titer/NAb 특성화를 정확히 연결한다. |
| Q17 | 적합 | sensitivity, drug tolerance, 간섭 완화와 예외를 assay suitability 맥락에서 연결한다. |
| Q18 | 부분 | NAb 목적·대안·validation은 맞지만 multi-tier 진입 조건과 development/validation 구획이 약하다. |
| Q19 | 부분 | 환자군 자료와 반복 설계는 맞지만 기존 cut point의 target-population 확인 절차가 약하다. |
| Q20 | 부적합 | 환자/제품 대분류만 있고 실제 하위 위험요인 대신 임상 결과로 이동한다. |
| Q21 | 부분 | patient/product 요인은 균형 있게 회수하지만 생성형 문단이라 비교축 UI가 없다. |
| Q22 | 부분 | baseline과 후속 채취 흐름은 맞지만 serial pre-dose와 추가 조건이 일부 누락된다. |
| Q23 | 부분 | SC 대비 IV 상대 위험은 맞지만 dose/frequency 축과 비교 표현이 부족하다. |
| Q24 | 적합 | aggregate 위험과 sub-visible particle 측정·특성화를 연결하고 요구로 과장하지 않는다. |
| Q25 | 적합 | 효능, PK/PD, 안전성 및 중화·과민반응 영향을 구조화하고 환자별 예측을 하지 않는다. |
| Q26 | 부적합 | EMA FIH 전체 개요를 dose-selection 절로 축소해 quality, trial planning, 범위 경계를 놓친다. |
| Q27 | 부분 | §6.1~§6.6을 모두 찾지만 절별 synopsis가 저맥락 문장 조각이다. |
| Q28 | 부분 | §7.1~§7.7은 완전하나 starting dose, escalation, maximum exposure/dose의 역할 요약이 약하다. |
| Q29 | 적합 | MABEL, PAD, NOAEL, 모델링, 불확실성 및 안전계수를 하나의 근거 흐름으로 설명한다. |
| Q30 | 부분 | 건강인/환자 차이는 정확하지만 예상 이익·위험 축과 비교 UI가 약하다. |
| Q31 | 부분 | EMA §7.4와 §8.2.6~§8.2.9로 교정됐으나 structured process의 문장 완결성과 순서가 부족하다. |
| Q32 | 부분 | maximum exposure와 maximum dose 근거를 분리하지만 직접 비교 결론과 관계 설명이 약하다. |
| Q33 | 부분 | sentinel과 예외 정당화는 맞지만 관찰간격 결정 취지가 일부 누락된다. |
| Q34 | 부분 | stopping rule/data review 관련 절은 맞지만 운영 흐름으로 읽히는 synopsis가 부족하다. |
| Q35 | 부분 | M3 주요 개발 단계 지도가 크게 개선됐지만 목적·범위와 생식독성 축이 불완전하다. |
| Q36 | 부분 | §5.1 기간 수치는 정확하나 행렬 UI와 지역/개발단계 차이가 없다. |
| Q37 | 부분 | §7.1~§7.3을 모두 분리하지만 절별 synopsis가 문장 조각이다. |
| Q38 | 적합 | 100 µg와 NOAEL 1/100을 함께 제시하고 각각 올바른 record-level 근거에 연결한다. |
| Q39 | 부분 | Approach 1/2 수치는 정확하나 동일 비교축 표가 아닌 생성 문단이다. |
| Q40 | 부분 | WOCBP 시간 순서는 맞지만 예외와 지역 차이가 부족하다. |
| Q41 | 적합 | MTD, exposure saturation, MFD, 상한과 예외를 구분하고 특정 용량을 추천하지 않는다. |
| Q42 | 부분 | S6의 시험물질·관련 종·반복투여 흐름은 있으나 면역원성, PK/PD, 특수 고려사항이 부족하다. |
| Q43 | 부분 | §2.1~§2.3을 모두 찾지만 visible synopsis의 맥락이 잘린다. |
| Q44 | 부분 | 한 종 조건은 맞지만 기본 2종 원칙→예외→정당화 순서가 없다. |
| Q45 | 적합 | relevant species 부재, homologous/transgenic 대안, 목적과 정량 위험평가 한계를 분리한다. |
| Q46 | 부분 | 관련 §3.1 근거는 맞지만 visible 주답변이 불완전하고 Part I §3.5 관계가 없다. |
| Q47 | 적합 | duration/recovery의 목적·결정요소·예외를 분리하고 예시를 절대화하지 않는다. |
| Q48 | 부분 | 올바른 S6 근거를 선택하지만 노출·PK/PD·독성 해석 논리가 주답변에 충분히 드러나지 않는다. |
| Q49 | 부적합 | 양쪽 Scope 절로 제한됐지만 M3 한국어 정규화가 ‘적용된다’로 잘려 공통 비교축 답변을 만들지 못한다. |
| Q50 | 부분 | S6와 EMA 역할을 함께 회수하지만 문서별 역할 구획, M3 범위, 추가 맥락 요청이 부족하다. |

## 4. 구현한 일반 규칙

1. 문서 코드·연도·명시적 절 제목을 identity gate로 분리하고, bare FIH/NOAEL 같은 맥락어가 문서명으로 오인되지 않게 했다.
2. 질문을 document overview, section overview, topic overview, process, within-document comparison, cross-document comparison, multi-criterion으로 분류한다.
3. broad 질문은 단일 고득점 숫자로 조기 확정하지 않고 source·section coverage를 먼저 구성한다. taxonomy 질문은 부모-자식 Section 그래프를 이용한다.
4. cohort, recovery, homologous protein, Approach 1/2, clinical-trial duration, accuracy/precision 같은 복합 개념은 함께 나타날 때만 의미 가중치를 적용한다.
5. explicit condition과 반대 조건, molecule/assay/topic scope 불일치를 차단한다.
6. 생성형 답변은 구조화 claims 범위 안에서만 생성하며, 비교에서 한 문서가 빠지거나 document/multi-criterion coverage가 붕괴하면 구조화 답변으로 되돌린다.
7. 같은 source unit의 서로 다른 정량 record를 보존하고 `record_id`를 우선 연결해 생성 문장과 근거 카드가 엇갈리지 않게 했다.
8. API 오류는 미완료로 기록하고 resume 시 성공 문항만 건너뛴다.

## 5. UI 결과

- 질문 옆에 API override 토글을 두었고 서버 health가 생성 기능을 제공할 때만 활성화된다.
- 질문이 실제로 통과한 route와 semantic mode를 헤더에 표시한다.
- 생성 route는 하나의 생성형 답변 면을 먼저, 그 아래에 구조화 근거를 표시한다.
- 근거는 항상 원문보다 `가이드라인 코드 · §번호 · 섹션 제목`을 먼저 표시한다.
- section overview는 직접 하위 절 색인, 절별 설명, 정량 기준, 접힌 원문으로 계층화한다.
- process와 cross-document comparison의 structured route는 각각 단계 목록과 문서 비교 레이아웃을 사용한다.
- source excerpt와 refusal은 생성 답변과 다른 경고·설명 UI를 사용한다.

## 6. 남은 일반 결함과 데이터 판단

전면 데이터 재구조화가 선행되어야 하는 상태는 아니다. 50문항의 대다수 실패는 기존 근거를 잘못 선택·묶거나 표현한 엔진 문제였고, 이번 변경으로 false refusal이 4건에서 0건으로 줄었다.

다만 남은 5개 부적합과 다수 부분 적합을 해결하려면 원본과 분리된 파생 의미 레이어가 필요하다.

- `source-grounded synopsis`: ‘적용된다’, ‘수반한다’ 같은 저맥락 `normalized_ko`를 절 대표문으로 쓰지 않기 위한 완결 문장
- `coverage manifest`: 상위 질문에 필요한 필수 하위 범주와 구조화 완료 여부
- `relation/order`: screening→confirmatory, dose→observe→review→decide 같은 관계
- `comparison_dimension`: 두 개념·문서를 같은 축으로 맞추기 위한 명시적 차원
- `salience`: broad 답변의 대표 근거와 펼침 근거 구분

이 필드는 원문·한국어 정규화·정량기준·조건과 분리해야 하며, 특정 질문용 정답 문구를 저장해서는 안 된다. 다음 우선순위는 Q06/Q15의 assay branch coverage, Q20/Q26의 B0 coverage manifest, Q49의 scope synopsis/comparison dimension, 그리고 generated semantic mode별 표·단계·지도 표현이다.
