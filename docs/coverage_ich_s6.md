# ICH S6(R1) Coverage Matrix & Ingestion Roadmap

## Overview
* **Document**: ICH S6(R1) Preclinical Safety Evaluation of Biotechnology-Derived Pharmaceuticals
* **Status**: Step 4 Final (Parent Guideline 16 July 1997 + Addendum 12 June 2011)
* **Master Target Bundle**: `data/pilots/s6_r1_species_selection.json`

---

## Section Ingestion Matrix

### Part I: Parent Guideline (1997) - 100% 완결
| Section | Title | PDF Page | Status | Description / Key Requirements |
| :--- | :--- | :---: | :---: | :--- |
| **Part I §1.1-1.3** | Introduction (Background, Objectives, Scope) | p. 1-2 | `COMPLETED` | **바이오의약품 적용 범위(단백질/펩타이드, r-DNA, mAb 등), 시작용량 산정/표적장기 확인 목표** (8 KR, 0 QC, 2 Cond) |
| **Part I §2.1-2.4** | Specification of Test Material | p. 2-3 | `COMPLETED` | **시험물질 규격(동질성/순도/안정성), 제조공정 변경 시 동등성 평가** (3 KR, 0 QC, 1 Cond) |
| **Part I §3.1-3.2** | General Principles & Biological Activity | p. 3-4 | `COMPLETED` | **생물학적 활성 기반 안전성 평가, In vitro/In vivo 약리활성 및 수용체 결합** (2 KR, 0 QC, 2 Cond) |
| **Part I §3.3** | Animal Species/Model Selection | p. 4-5 | `COMPLETED` | **관련 동물종(Relevant Species) 선정 원칙** (14 KR, 1 QC, 10 Cond) |
| **Part I §3.4-3.6** | Number/Gender, Administration, Immunogenicity | p. 5-6 | `COMPLETED` | **암수 양성 사용, 임상 투여경로 반영, 동물 면역원성 측정 및 해석(조기종료 기준 배제)** (7 KR, 0 QC, 4 Cond) |
| **Part I §4.1-4.3** | Safety Pharmacology, PK/TK, Single-Dose | p. 6-7 | `COMPLETED` | **안전성약리(심혈관/호흡기/중추신경계 필수기능 평가), PK/TK 노출 평가, 단회투여독성** (6 KR, 0 QC, 0 Cond) |
| **Part I §4.4-4.5** | Repeated-Dose Toxicity & Immunotoxicity | p. 7-8 | `COMPLETED` | **반복투여독성 기간/용량 설정, 표적장기 및 가역성 평가, 면역독성 요건** (5 KR, 4 QC, 2 Cond) |
| **Part I §4.6-4.9** | Reproductive Toxicity, Genotox, Carcino, Local | p. 8-10 | `COMPLETED` | **생식발생독성, 유전독성(원칙적 시험 불필요/면제), 발암성 2년 표준시험 부적합성, 국소자극성** (4 KR, 0 QC, 1 Cond) |
| **Part I Notes** | Notes 1 to 8 | p. 10 | `COMPLETED` | **Parent Guideline 주석 (질환모델 동물 사용 정당성 등)** (3 KR, 0 QC, 0 Cond) |

### Part II: Addendum to ICH S6 (2011)
| Section | Title | PDF Page | Status | Description / Key Requirements |
| :--- | :--- | :---: | :---: | :--- |
| **Part II §1** | Introduction | p. 11 | `BACKLOG` | Addendum 목적 및 적용 범위 |
| **Part II §2.1-2.2** | Species Selection & One vs Two Species | p. 11-13 | `COMPLETED` | **단일 종 vs 2종 사용 정당화 기준, 단기 독성 후 1종 전환 기준** (24 KR, 2 QC, 12 Cond) |
| **Part II §2.3** | Non-Human Primates (NHP) | p. 13-14 | `BACKLOG` | NHP(영장류) 사용 최소화 및 과학적 정당화 |
| **Part II §3.1-3.3** | Study Design (Dose Selection, Duration, Recovery) | p. 14-16 | `BACKLOG` | 고용량(High Dose) 설정(10배 노출 또는 1,000mg/kg), 만성독성 기간(6개월), 회복시험 |
| **Part II §4** | Immunogenicity | p. 16 | `BACKLOG` | 면역원성 데이터 해석 및 독성시험 평가 영향 |
| **Part II §5.1-5.4** | Reproductive and Developmental Toxicity | p. 16-19 | `BACKLOG` | EFD(배태자발생독성), ePPND(확장 산전산후발생독성), 영장류 연구 디자인 |
| **Part II §6** | Carcinogenicity | p. 19-20 | `BACKLOG` | 면역원성 및 생물학적 활성을 고려한 발암성 위해성 평가 |
| **Part II Notes** | Addendum Notes 1 to 8 | p. 20-22 | `COMPLETED` | **ADC 종선택, MABEL, 회복기간 등 Addendum 주석** (24 KR, 1 QC, 8 Cond) |

---

## Summary Statistics
* **적재 완료 섹션 수 (Completed)**: **15개 섹션** (Part I 100% 전수 완결, Part II §2.1/2.2 & Notes 완결)
* **총 구조화 데이터 규모 (ICH S6(R1))**: **100 KnowledgeRecords, 7 QuantitativeCriteria, 42 Conditions** (총 149개 엔티티, 100% `reviewed`)
* **아카이브 전체 엔티티 규모**: **1,892개 엔티티** (ICH M10 585 + FDA ADA 667 + EMA FIH 491 + ICH S6 149)
* **잔여 백로그 (Backlog)**: Batch 2 (Part II Addendum 잔여 전수: §1, §2.3 NHP, §3.1-3.3 고용량 10배 및 6개월, §4, §5.1-5.4 EFD/ePPND, §6 발암성)
