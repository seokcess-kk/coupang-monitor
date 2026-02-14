# Plan: 버튼 기능 검토 및 구현

## 개요
대시보드 UI의 모든 버튼이 정상적으로 작동하는지 검토하고 누락된 기능을 구현합니다.

## 현재 버튼 목록 및 상태

### 1. 대시보드 (/app/components/Dashboard.tsx)

| 버튼 | 기능 | API | 상태 |
|------|------|-----|------|
| **Refresh All** | 모든 상품 가격 수집 트리거 | `POST /api/jobs/enqueue` | ✅ 구현됨 |
| **+ 상품 추가** | 개별 상품 URL 추가 모달 | `POST /api/items` | ✅ 구현됨 |
| **CSV 업로드** | CSV 업로드 패널 토글 | - | ✅ 구현됨 |
| **전체/정상/품절/에러** | 상태별 필터링 | 클라이언트 필터 | ✅ 구현됨 |

### 2. CSV 업로드 (/app/components/CsvUpload.tsx)

| 버튼 | 기능 | API | 상태 |
|------|------|-----|------|
| **파일 선택 영역** | CSV 파일 업로드 | `POST /api/items/upload-csv` | ✅ 구현됨 |
| **템플릿 다운로드** | CSV 템플릿 다운로드 | 클라이언트 생성 | ✅ 구현됨 |

### 3. 상품 테이블 (/app/components/ItemTable.tsx)

| 버튼 | 기능 | API | 상태 |
|------|------|-----|------|
| **상품명 클릭** | 상세 페이지 이동 | - | ✅ 구현됨 |
| **🔗 링크 아이콘** | 쿠팡 페이지 열기 | 외부 링크 | ✅ 구현됨 |
| **수정** | 상품 정보 수정 모달 | `PATCH /api/items/[id]` | ✅ 구현됨 |
| **삭제** | 상품 삭제 (확인 후) | `DELETE /api/items/[id]` | ✅ 구현됨 |

### 4. 상품 추가 모달 (/app/components/AddItemModal.tsx)

| 버튼 | 기능 | API | 상태 |
|------|------|-----|------|
| **취소** | 모달 닫기 | - | ✅ 구현됨 |
| **추가** | 상품 추가 실행 | `POST /api/items` | ✅ 구현됨 |
| **X (닫기)** | 모달 닫기 | - | ✅ 구현됨 |

### 5. 상품 수정 모달 (/app/components/EditItemModal.tsx)

| 버튼 | 기능 | API | 상태 |
|------|------|-----|------|
| **취소** | 모달 닫기 | - | ✅ 구현됨 |
| **저장** | 수정 내용 저장 | `PATCH /api/items/[id]` | ✅ 구현됨 |
| **X (닫기)** | 모달 닫기 | - | ✅ 구현됨 |

### 6. 상세 페이지 (/app/items/[id]/ItemDetail.tsx)

| 버튼 | 기능 | API | 상태 |
|------|------|-----|------|
| **Back to Dashboard** | 대시보드로 이동 | - | ✅ 구현됨 |
| **URL 링크** | 쿠팡 페이지 열기 | 외부 링크 | ✅ 구현됨 |

## 잠재적 문제점

### 1. Refresh All 버튼 - 기능 검증 필요
- **현재 동작**: Job 테이블에 PENDING 작업 추가
- **문제**: 로컬 스크래퍼가 Job 큐를 폴링하지 않음 (CDP 모드 직접 실행)
- **해결**: Refresh 버튼이 로컬 스크래퍼를 트리거하도록 수정 필요

### 2. 스크래퍼 실행 방식 불일치
- **Web UI**: Job 큐 기반 (`/api/jobs/enqueue`)
- **CLI**: 직접 CDP 연결 (`pnpm scraper:run`)
- **문제**: UI에서 Refresh 버튼 클릭 시 실제 스크래핑이 실행되지 않음

## 해결 방안

### Option A: 로컬 스크래퍼 서버 모드 (권장)
1. 스크래퍼를 로컬 서버로 실행 (`pnpm scraper:server`)
2. Web에서 API 호출 → 스크래퍼 서버가 수행
3. 진행 상황을 SSE로 실시간 전송

### Option B: Web에서 스크래퍼 직접 트리거
1. Scraper Trigger API 사용 (`POST /api/scraper/trigger`)
2. 이미 구현된 것으로 보이나 연동 필요

## 구현 작업

### Task 1: Refresh 버튼 동작 확인
- [ ] `/api/scraper/trigger` API 확인
- [ ] RefreshButton이 트리거 API를 호출하도록 수정

### Task 2: 진행 상황 표시
- [ ] `/api/scraper/progress` API 확인
- [ ] RefreshButton에 진행률 표시 추가

### Task 3: 기능 테스트
- [ ] 모든 버튼 수동 테스트
- [ ] 에러 케이스 처리 확인

## API 현황

| Endpoint | Method | 상태 |
|----------|--------|------|
| `/api/items` | GET | ✅ |
| `/api/items` | POST | ✅ |
| `/api/items/[id]` | GET | ✅ |
| `/api/items/[id]` | PATCH | ✅ |
| `/api/items/[id]` | DELETE | ✅ |
| `/api/items/upload-csv` | POST | ✅ |
| `/api/jobs/enqueue` | POST | ✅ |
| `/api/scraper/trigger` | POST | 🔍 확인 필요 |
| `/api/scraper/progress` | GET | 🔍 확인 필요 |

## 분석 결과

### 발견된 문제
1. **스크래퍼 서버 (`server.ts`)가 CDP 모드 미사용**
   - 현재: `ScraperService` (Puppeteer headless - 쿠팡 차단됨)
   - 필요: `CDPScraperService` (Chrome 연결 - 정상 작동)

2. **Refresh 버튼 동작 흐름**
   - UI: `RefreshButton` → `POST /api/jobs/enqueue` (Job 큐에 추가)
   - 문제: 스크래퍼 서버가 Job 큐를 폴링하지 않음
   - 대안 API: `POST /api/scraper/trigger` → 스크래퍼 서버 `/run` 호출

3. **스크래퍼 서버 연동 필요**
   - Web: `POST /api/scraper/trigger` → Scraper: `POST /run`
   - Web: `GET /api/scraper/progress` → Scraper: `GET /progress`

## 구현 작업

### Task 1: 스크래퍼 서버 CDP 모드 전환
- [ ] `server.ts`에서 `CDPScraperService` 사용하도록 수정
- [ ] Chrome Debug 모드 체크 로직 추가

### Task 2: RefreshButton 트리거 API 연동
- [ ] `RefreshButton`이 `/api/scraper/trigger` 호출하도록 수정
- [ ] 또는 Job 큐 방식 유지하고 스크래퍼 서버가 폴링하도록 수정

### Task 3: 진행 상황 표시
- [ ] RefreshButton에 폴링으로 진행률 표시
- [ ] `/api/scraper/progress` 활용

### Task 4: 기능 테스트
- [ ] 모든 버튼 수동 테스트

## 우선순위

1. **높음**: 스크래퍼 서버 CDP 모드 전환 (현재 차단됨)
2. **높음**: RefreshButton → 스크래퍼 트리거 연동
3. **중간**: 진행 상황 실시간 표시
4. **낮음**: UI 개선 (로딩 상태, 에러 메시지)
