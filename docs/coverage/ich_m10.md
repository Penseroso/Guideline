# ICH M10 Coverage Matrix (Bioanalytical Method Validation & Study Sample Analysis)

## Overview
* **Document**: ICH M10 (Final Step 4, 24 May 2022)
* **Source PDF**: `source_pdfs/ICH M10.pdf` (59 pages)
* **Master Bundle**: `data/pilots/ich_m10_validation.json`

---

## Detailed Section Coverage Matrix

| Section | Title | Printed Page | Status | Key Focus & Entities |
| :--- | :--- | :--- | :--- | :--- |
| **1.1** | Objective | p. 6 | `COMPLETED` | 생체시료분석법 밸리데이션 목적 및 과학적 타당성 근거 변경 허용 |
| **1.2** | Background | p. 6 | `COMPLETED` | 의약품 허가 규제 결정 기여 및 3Rs(동물실험 대체/감소/완화) 원칙 |
| **1.3** | Scope | p. 6-7 | `COMPLETED` | 저분자/바이오의약품, 비임상 TK(GLP)/대체 PK, 임상 전단계/생동(BA/BE) 적용, 바이오마커/면역원성 제외 |
| **2.1** | Method Development | p. 7 | `COMPLETED` | 분석법 개발 목적, 물리화학적 특성/단백결합/적혈구분포 이해, 개발 요소 |
| **2.2.1** | Full Validation | p. 8 | `COMPLETED` | **Full Validation 요건 (신규 개발, 문헌 분석법 도입, 상용 키트 의약품 전용, 1차 기질)** |
| **2.2.2** | Partial Validation (Overview) | p. 9 | `COMPLETED` | 기 밸리데이션 분석법 변경 시 부분 밸리데이션 원칙 |
| **2.2.3** | Cross Validation (Overview) | p. 9 | `COMPLETED` | 복수 분석법/기관 간 데이터 비교 및 통합 시 교차 밸리데이션 원칙 |
| **3.1** | Chromatography: Reference Standards | p. 9-10 | `COMPLETED` | **표준물질 성적서(CoA), IS(내부표준물질), 스톡 용액 조제 및 안정성 검증** (6 KR, 0 QC, 1 Cond) |
| **3.2.1** | Selectivity | p. 10-11 | `COMPLETED` | **선택성 (최소 6개 개별 블랭크 기질, LLOQ 신호 20% / IS 5% 간섭 한계)** (6 KR, 3 QC, 4 Cond) |
| **3.2.2** | Specificity | p. 11 | `COMPLETED` | **특이성 (병용 투여 약물, 대사체 간섭 배제, LLOQ 20% / IS 5% 기준)** (4 KR, 2 QC, 4 Cond) |
| **3.2.3** | Matrix Effect | p. 11-12 | `COMPLETED` | **기질 효과 (최소 6개 로트 기질계수 MF, IS 정규화 MF %CV ≤ 15%)** (3 KR, 4 QC, 3 Cond) |
| **3.2.4** | Calibration Curve and Range | p. 12-13 | `COMPLETED` | **검량선 모델, 최소 6개 농도, LLOQ 20% / 기타 15% 허용오차, 75% 충족 요건** (3 KR, 8 QC, 5 Cond) |
| **3.2.5.1** | QC Preparation | p. 13-14 | `COMPLETED` | **QC 농도 조제 (LLOQ, Low ≤3xLLOQ, Med 30-50%, High ≥75% ULOQ)** (2 KR, 7 QC, 4 Cond) |
| **3.2.5.2** | Evaluation of Accuracy and Precision | p. 14 | `COMPLETED` | **정확도/정밀도 (3런 이상, 5농도 각 5반복 이상, 15%/20% 기준, 2/3 및 50% 규칙)** (14 KR, 12 QC, 7 Cond) |
| **3.2.6** | Carry-over | p. 14-15 | `COMPLETED` | **잔적 효과 (블랭크 시료에서 LLOQ 20%, IS 5% 이하)** (1 KR, 2 QC, 6 Cond) |
| **3.2.7** | Dilution Integrity | p. 15 | `COMPLETED` | **희석 무결성 (ULOQ 초과 농도 희석 평가, 정확도 ±15%, 정밀도 ≤15%)** (2 KR, 3 QC, 3 Cond) |
| **3.2.8** | Stability | p. 15-18 | `COMPLETED` | **전혈 안정성, 동결-융해(최소 3사이클 12시간), 단기 실온, 장기 동결, 자가주입기/추출액 안정성 (±15%)** (5 KR, 4 QC, 6 Cond) |
| **3.2.9** | Reinjection Reproducibility | p. 18 | `COMPLETED` | **재주입 재현성 평가 (최소 5반복 Low/Med/High QC, ±15%, %CV ≤ 15%)** (2 KR, 4 QC, 1 Cond) |
| **3.3.1-6**| Study Sample Analysis (Chromatography) | p. 18-23 | `COMPLETED` | **분석 런 수락 기준(4-6-15 규칙), 검량 범위 조정, 재분석(PK 사유 재분석 금지), 재주입, 크로마토그램 적분** (15 KR, 13 QC, 18 Cond) |
| **4.1-3** | Ligand Binding Assays (LBA) | p. 23-33 | `COMPLETED` | **LBA 핵심 시약 관리, 특이성, 선택성(10명 검체 80%), 4/5-Parameter 검량선(20%/25%), 정확도/정밀도(20%/25%, Total Error 30%/40%), Carry-over, 희석선형성/Hook효과, 안정성, 4-6-20 런 수락 기준** (62 KR, 55 QC, 56 Cond) |
| **5** | Incurred Sample Reanalysis (ISR) | p. 33-35 | `COMPLETED` | **ISR 대상 시험(비임상 동물종별 1회, BA/BE, 최초 임상), 검체수 비율(1,000개까지 10%, 초과분 5%), 수락 기준(크로마토그래피 4-6-20 규칙, LBA 4-6-30 규칙)** (4 KR, 15 QC, 13 Cond) |
| **6.1** | Partial Validation (Details) | p. 35-36 | `COMPLETED` | **크로마토그래피 및 LBA 부분 밸리데이션 대상 변경 상황 목록** (23 KR, 0 QC, 6 Cond) |
| **6.2** | Cross Validation (Details) | p. 36-37 | `COMPLETED` | **동일 시험 내/시험 간 교차 밸리데이션 요건 (QC 3농도 3반복, 검체 n≥30, Bland-Altman/Deming 회귀)** (11 KR, 2 QC, 9 Cond) |
| **7.1-6** | Additional Considerations | p. 37-44 | `COMPLETED` | **내인성 물질 분석(4대 접근법: 대체기질/대체분석물질/배경차감/표준물질첨가법), Parallelism(%CV≤30%), 회수율, MRD, 상용/진단용 키트 밸리데이션, 신기술 및 건조기질법(DBS/DMM)** (22 KR, 6 QC, 30 Cond) |
| **8** | Documentation | p. 44-53 | `COMPLETED` | **eCTD 2.6.4/2.7.1 요약 정보, 밸리데이션 보고서, 생체분석 보고서 기재 항목, Table 1(제출/실사 문서 요건) 및 Table 2(요약 템플릿 표 1/2/3)** (6 KR, 4 QC, 2 Cond) |
| **9** | Glossary | p. 53-59 | `COMPLETED` | **ICH M10 핵심 생체분석 용어 정의 28종** (2 KR, 0 QC, 0 Cond) |

---

## Summary Statistics
* **전체 섹션 수**: 26개 주요 단원 (총 66개 서브섹션)
* **적재 완료 섹션 수 (Completed)**: **26개 섹션 (100% 전수 적재 완료)**
* **총 구조화 데이터 규모 (ICH M10)**: **237 KnowledgeRecords, 145 QuantitativeCriteria, 203 Conditions** (총 585개 엔티티, 100% `reviewed`)
* **아카이브 전체 엔티티 규모**: **1,841개 엔티티** (ICH M10 585 + ICH S6 98 + EMA FIH 491 + FDA ADA 667)
* **잔여 백로그 (Backlog)**: **없음 (ICH M10 전수 100% Ingestion 달성)**
