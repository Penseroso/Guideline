# PDF Assessment: ICH M10

## 1. 점검 대상

- 프로젝트 경로: `C:\Users\User\Desktop\FILE\AI\Guideline`
- 요청된 원본 PDF 폴더명: `가이드라인 파일/`
- 실제 확인된 원본 PDF 폴더명: `Guideline Files/`
- 파일럿 PDF 정확한 파일명: `ICH M10.pdf`
- 실제 파일 경로: `Guideline Files/ICH M10.pdf`
- 파일 크기: 753,778 bytes
- 최종 수정 시각: 2026-06-30 09:30:54

참고: 현재 작업공간에는 `가이드라인 파일/` 폴더가 없고, `Guideline Files/` 폴더에 ICH M10 PDF가 존재한다. 원본 PDF는 이동, 수정, 이름 변경, 덮어쓰기하지 않았다.

## 2. 현재 작업공간 파일 목록 확인 결과

점검 시작 시점의 최상위 항목:

- `Guideline Files/`

확인된 원본 PDF:

- `Guideline Files/ICH M10.pdf`

이번 단계에서 생성한 영문 폴더:

- `structured_data/`
- `working_docs/`
- `scripts/`

## 3. PDF 형식 및 텍스트 기반 여부

점검 방법:

- PDF 헤더 확인: `%PDF-1.7`
- PDF 내부 객체/스트림 검사
- Ghostscript `txtwrite` 장치를 사용한 텍스트 추출 샘플 확인

관찰 결과:

- PDF page marker: 59개
- image marker: 1개
- font marker: 78개
- FlateDecode stream: 82개
- 압축 해제 가능한 stream: 82개
- PDF 텍스트 연산자(`BT`, `ET`, `Tj`, `TJ`)가 다수 확인됨

판정:

- ICH M10 PDF는 스캔 이미지 기반이 아니라 텍스트 기반 PDF로 판단된다.
- OCR은 현재 파일럿 추출의 기본 경로로 필요하지 않다.
- 다만 표, 머리글/꼬리글, 페이지 번호, 특수문자 처리를 위해 후처리 규칙이 필요하다.

## 4. 텍스트 추출 품질 점검

### 4.1 목차

보존 상태: 양호

관찰 내용:

- `TABLE OF CONTENTS`가 텍스트로 추출된다.
- section/subsection 제목과 PDF 페이지 번호가 함께 추출된다.
- 점선 leader도 대부분 유지된다.

예상 오류:

- 목차의 긴 줄은 줄바꿈 위치가 흔들릴 수 있다.
- 목차 페이지 번호와 본문 페이지 번호가 같은 숫자 패턴으로 추출되므로 구분 규칙이 필요하다.

### 4.2 section 및 subsection 번호

보존 상태: 양호

관찰 내용:

- `1. INTRODUCTION`, `1.1 Objective`, `3.2.5.2 Evaluation of Accuracy and Precision` 같은 계층 번호가 추출된다.
- 목차와 본문 양쪽에 동일한 section 번호가 존재한다.

예상 오류:

- 목차 항목과 본문 heading을 구분하지 않으면 section이 중복 생성될 수 있다.
- 긴 heading은 줄바꿈으로 인해 제목 일부가 다음 줄로 분리될 수 있다.

### 4.3 PDF 페이지 번호

보존 상태: 부분 보존

관찰 내용:

- 본문 하단의 페이지 번호가 독립 숫자 줄로 추출된다.
- 추출 결과에서 `3`부터 `59`까지의 footer형 페이지 번호가 확인된다.
- PDF 내부 page marker는 59개로 확인된다.

예상 오류:

- Ghostscript `txtwrite` 기본 추출에는 form feed 같은 명확한 페이지 구분자가 포함되지 않았다.
- 페이지 번호는 footer 텍스트로는 보존되지만, 문단과 페이지의 정확한 매핑에는 별도 페이지 단위 추출 또는 좌표 기반 추출이 필요하다.
- 첫 표지/문서 이력 페이지와 본문 페이지 번호 체계가 다를 수 있으므로 PDF 물리 페이지와 인쇄 페이지 번호를 별도 필드로 관리해야 한다.

### 4.4 문단 순서

보존 상태: 대체로 양호

관찰 내용:

- 본문 section에서는 문단 순서가 자연스럽게 추출된다.
- 일반 단락의 줄 순서는 원문 읽기 순서와 대체로 일치한다.

예상 오류:

- 머리글 `ICH M10 Guideline`과 footer 페이지 번호가 본문 사이에 섞인다.
- 표가 포함된 페이지에서는 열 단위 읽기 순서가 문단 순서와 다르게 섞일 수 있다.
- 페이지 전환부에서 heading, footer, 다음 페이지 본문이 인접하게 추출될 수 있다.

### 4.5 표

보존 상태: 부분 보존, 구조 손실 위험 높음

관찰 내용:

- `Document History` 표와 `Table 1: Documentation and Reporting`의 텍스트는 추출된다.
- 표의 column heading과 cell 텍스트는 상당 부분 보존된다.
- bullet 문자는 추출된다.

예상 오류:

- 열 구조가 Markdown/CSV 형태로 보존되지 않는다.
- 긴 cell 내용은 여러 줄로 wrap되며, 다른 열의 내용과 같은 행에서 섞일 수 있다.
- `Table 1 continued`처럼 여러 페이지에 이어지는 표는 페이지 header/footer와 반복 column heading이 섞인다.
- 표 1은 단순 줄 단위 파싱만으로는 안정적인 구조화가 어렵고, 표 전용 후처리 또는 수동 검수 대상이다.

### 4.6 각주

보존 상태: 부분 보존

관찰 내용:

- 표 하단의 `*`, `†`, `††` footnote marker와 footnote 문구가 추출된다.
- 예: `*The applicant...`, `† May append...`, `†† Submit either...`

예상 오류:

- 각주 marker와 본문/표 cell 내 marker의 연결 관계는 자동으로 보존되지 않는다.
- 일부 각주는 페이지 하단 또는 표 continuation 위치에 따라 관련 표 행과 멀어질 수 있다.
- 각주를 별도 note entity로 분리하고, 연결 대상 table/row/column을 수동 또는 규칙 기반으로 매핑해야 한다.

### 4.7 수치 기준

보존 상태: 양호

관찰 내용:

- `15%`, `20%`, `5%`, `30%`, `40%`, `LLOQ`, `ULOQ` 등이 추출된다.
- `±15%`, `±20%`, `× 100` 같은 특수기호 포함 수식도 추출 샘플에서 보존된다.

예상 오류:

- 추출 경로 또는 인코딩 설정에 따라 특수문자가 mojibake로 보일 가능성이 있다.
- 수치 기준은 문맥 의존적이므로, 구조화 시 숫자만 분리하면 적용 대상과 조건이 손실될 수 있다.
- 예외 조건, LLOQ/ULOQ별 기준, chromatography/LBA별 기준을 구분해야 한다.

### 4.8 cross-reference

보존 상태: 양호

관찰 내용:

- `Refer to Section 8 Documentation and Table 1`, `Refer to Table 1`, `Section 8.1` 같은 참조 문구가 추출된다.

예상 오류:

- cross-reference 대상 section/table ID가 자동 링크 형태로 보존되지는 않는다.
- `Section 8`, `Section 8.1`, `Table 1`처럼 대상 유형별 정규화가 필요하다.
- 목차의 항목과 본문 내 참조 문구를 구분해야 한다.

## 5. 주요 예상 오류 목록

1. 목차 항목과 본문 heading 중복 인식
2. header/footer와 본문 문단 혼입
3. PDF 물리 페이지 번호와 문서 인쇄 페이지 번호 혼동
4. 표의 행/열 구조 손실
5. 여러 페이지에 걸친 표의 continuation 처리 오류
6. 각주 marker와 각주 본문 연결 손실
7. 수치 기준의 적용 조건 누락
8. cross-reference target 정규화 누락
9. 특수문자 인코딩 문제 가능성
10. 줄바꿈으로 인한 heading 또는 문장 분절

## 6. 구조화 전 권장 처리 방침

- `document_id`는 모든 문서 공통 데이터셋에서 ICH M10을 구분할 수 있도록 별도 부여한다.
- `section_id`는 본문 heading 기준으로 생성하되, 목차에서 추출된 heading은 본문 section으로 중복 등록하지 않는다.
- page 정보는 최소한 `pdf_page_index`와 `printed_page_number`를 분리해 관리한다.
- header/footer 제거 규칙을 먼저 적용한 뒤 문단 병합을 수행한다.
- 표 1은 자동 추출 결과만 신뢰하지 말고 별도 검수 대상으로 표시한다.
- 각주는 본문 paragraph와 분리해 note로 저장하고, 가능한 경우 source table 또는 section에 연결한다.
- 수치 기준은 값, 단위, comparator, 적용 대상, 예외 조건, source section을 함께 저장해야 한다.
- cross-reference는 원문 문자열과 정규화된 target 후보를 함께 저장한다.

## 7. 현재 단계에서 하지 않은 작업

- 전체 문서 구조화는 수행하지 않았다.
- 웹앱은 구현하지 않았다.
- 자동 판정 로직은 구현하지 않았다.
- 규제적 권고 또는 해석은 작성하지 않았다.
- 시험 설계 엔진은 구현하지 않았다.
- 원본 PDF는 이동, 수정, 이름 변경 또는 덮어쓰기하지 않았다.
- 오류 방지를 위해 신규 작업 산출물의 파일 및 폴더명은 영문을 사용한다.
