# Implementation Plan: PriceWatch MVP

**Status**: ✅ Complete
**Started**: 2026-01-27
**Last Updated**: 2026-01-27

---

**⚠️ CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date above
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to next phase

⛔ **DO NOT skip quality gates or proceed with failing checks**

---

## 📋 Overview

### Feature Description
PriceWatch는 쿠팡(Coupang) 상품 가격 모니터링 SaaS MVP이다. 최대 100개 상품 URL의 옵션별 표시가(displayed base price)를 추적하고, 7일/30일 최저가를 관리하며, 신저가 발생 시 Slack 알림을 발송한다. 가격 수집은 Chrome Extension(MV3)이 DOM을 읽어 수행하며, 서버 사이드 스크래핑은 사용하지 않는다.

### Success Criteria
- [ ] CSV 업로드로 아이템 등록, URL 정규화 및 중복 제거 작동
- [ ] 대시보드에서 current_low, 7D/30D 최저가, 상태 표시
- [ ] 아이템 상세에서 가격 추세 + 옵션별 테이블 표시
- [ ] 수동 새로고침 (전체/선택) 작동
- [ ] 스케줄 새로고침 + 분산 큐 작동
- [ ] Extension이 잡을 폴링하고, DOM 스크래핑 후 스냅샷 업로드
- [ ] 7D/30D 신저가 시 Slack 알림 발송

### User Impact
쿠팡 판매자/구매자가 수동 확인 없이 자동으로 가격 변동을 추적하고, 최저가 시점에 즉시 알림을 받을 수 있다.

---

## 🏗️ Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| pnpm monorepo | DB 패키지를 웹앱/익스텐션이 공유; 단일 저장소 관리 편의 | Extension은 별도 빌드 필요 |
| Next.js App Router | API Routes + SSR UI를 하나의 앱으로; Vercel 배포 최적화 | 클라이언트 상태 관리 제한적 |
| Prisma ORM | 타입 안전한 DB 접근; 스키마 기반 마이그레이션 | Raw SQL 대비 유연성 낮음 |
| Chrome Extension MV3 | 서버 스크래핑 없이 DOM 읽기; 사용자 브라우저 세션 활용 | 사용자 PC에 Extension 설치 필요 |
| Slack Webhook | 별도 알림 서버 불필요; 간단한 HTTP POST | Slack 외 알림 채널 추가 시 확장 필요 |
| 단일 동시성 (concurrency=1) | 쿠팡 차단 위험 최소화; MVP 복잡도 감소 | 100개 아이템 전체 수집 시간 증가 |

---

## 📦 Dependencies

### Required Before Starting
- [ ] Node.js >= 18 설치
- [ ] pnpm 설치 (`npm install -g pnpm`)
- [ ] PostgreSQL 데이터베이스 (Supabase 또는 로컬)
- [ ] Chrome 브라우저 (Extension 테스트용)

### External Dependencies
- next: ^14.x
- prisma / @prisma/client: ^5.x
- typescript: ^5.x
- papaparse: ^5.x (CSV 파싱)
- vitest: ^1.x (테스트)
- @testing-library/react: ^14.x (UI 테스트)
- chart.js + react-chartjs-2 (가격 추세 차트)

---

## 🧪 Test Strategy

### Testing Approach
**TDD Principle**: Write tests FIRST, then implement to make them pass

### Test Pyramid for This Feature
| Test Type | Coverage Target | Purpose |
|-----------|-----------------|---------|
| **Unit Tests** | ≥80% | URL 정규화, 가격 파싱, CSV 검증, 최저가 계산 |
| **Integration Tests** | Critical paths | API 엔드포인트, DB 연동, Snapshot→PriceEvent 플로우 |
| **E2E Tests** | Key user flows | CSV 업로드→대시보드 표시, Extension 폴링→업로드 |

### Test File Organization
```
__tests__/
├── unit/
│   ├── url-normalization.test.ts
│   ├── csv-parser.test.ts
│   ├── price-calculation.test.ts
│   └── price-extraction.test.ts
├── integration/
│   ├── api/
│   │   ├── items-upload.test.ts
│   │   ├── items-list.test.ts
│   │   ├── items-detail.test.ts
│   │   ├── jobs-enqueue.test.ts
│   │   ├── jobs-next.test.ts
│   │   └── snapshots-batch.test.ts
│   └── services/
│       ├── price-event.test.ts
│       └── slack-alert.test.ts
└── e2e/
    └── full-flow.test.ts
```

### Coverage Requirements by Phase
- **Phase 1 (Foundation)**: 프로젝트 빌드 및 DB 연결 검증
- **Phase 2 (CSV/URL)**: URL 정규화 ≥90%, CSV 파싱 ≥80%
- **Phase 3 (Items API)**: API 엔드포인트 ≥70%, 가격 계산 ≥90%
- **Phase 4 (Jobs API)**: API 엔드포인트 ≥70%, 인증 로직 ≥80%
- **Phase 5 (Snapshots)**: 배치 처리 ≥80%, PriceEvent ≥90%
- **Phase 6 (Extension)**: DOM 추출 로직 ≥80%
- **Phase 7 (UI)**: 통합 테스트로 주요 사용자 플로우 검증

---

## 🚀 Implementation Phases

---

### Phase 1: Monorepo Foundation & DB Setup
**Goal**: pnpm 모노레포 구조, Prisma 클라이언트, Next.js 앱 스켈레톤, DB 마이그레이션 완료
**Status**: ✅ Complete

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 1.1**: Prisma 클라이언트 연결 테스트
  - File: `packages/db/__tests__/client.test.ts`
  - Expected: DB 연결 및 기본 쿼리 가능 확인
  - Details:
    - DB 연결 성공 확인
    - Item 모델 CRUD 기본 동작

- [ ] **Test 1.2**: Next.js 앱 헬스체크
  - File: `apps/web/__tests__/health.test.ts`
  - Expected: `/api/health` 엔드포인트 200 응답

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 1.3**: 루트 모노레포 설정
  - Files: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`
  - Details:
    - pnpm workspace 설정 (apps/*, packages/*)
    - 루트 TypeScript 설정
    - 공통 스크립트 (dev, build, test, lint)

- [ ] **Task 1.4**: packages/db 패키지 설정
  - Files: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/index.ts`
  - Details:
    - Prisma client 생성 및 export
    - `prisma migrate dev` 실행하여 초기 마이그레이션
    - 기존 schema.prisma 활용

- [ ] **Task 1.5**: Next.js 앱 초기화
  - Files: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`
  - Details:
    - App Router 구조
    - `@pricewatch/db` 의존성 연결
    - `/api/health` 엔드포인트 생성
    - `.env` 파일 설정

- [ ] **Task 1.6**: 테스트 인프라 설정
  - Files: `vitest.config.ts`, `vitest.workspace.ts`
  - Details:
    - Vitest 설정 (unit + integration)
    - 테스트용 DB 연결 설정

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 1.7**: 프로젝트 구조 정리
  - Checklist:
    - [ ] 모든 패키지 빌드 확인
    - [ ] TypeScript strict 모드 활성화
    - [ ] ESLint + Prettier 설정
    - [ ] .gitignore 업데이트

#### Quality Gate ✋

**⚠️ STOP: Do NOT proceed to Phase 2 until ALL checks pass**

**TDD Compliance**:
- [ ] Tests written FIRST and initially failed
- [ ] Production code makes tests pass
- [ ] Code improved while tests stay green

**Build & Tests**:
- [ ] `pnpm build` 성공
- [ ] `pnpm test` 모든 테스트 통과
- [ ] DB 마이그레이션 정상 적용

**Code Quality**:
- [ ] `pnpm lint` 에러 없음
- [ ] TypeScript 컴파일 에러 없음

**Validation Commands**:
```bash
pnpm build
pnpm test
pnpm lint
pnpm prisma migrate status
```

**Manual Test Checklist**:
- [ ] `pnpm dev` 실행 후 localhost:3000 접근 가능
- [ ] `/api/health` 엔드포인트 200 응답
- [ ] Prisma Studio에서 테이블 확인 (`pnpm prisma studio`)

---

### Phase 2: URL Normalization & CSV Import
**Goal**: URL 정규화 유틸리티, CSV 파싱/검증, `POST /api/items/upload-csv` 엔드포인트 완성
**Status**: ✅ Complete

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 2.1**: URL 정규화 단위 테스트
  - File: `packages/db/__tests__/url-normalization.test.ts`
  - Expected: 다양한 쿠팡 URL → canonical form 변환
  - Details:
    - 트래킹 파라미터 제거 (q, searchId, rank, traceId 등)
    - canonical URL 생성: `https://www.coupang.com/vp/products/{productId}?itemId={itemId}&vendorItemId={vendorItemId}`
    - dedupe key 생성: `{productId}:{itemId}:{vendorItemId}`
    - 잘못된 URL 에러 처리
    - vendorItemId 없는 경우 처리

- [ ] **Test 2.2**: CSV 파싱 단위 테스트
  - File: `apps/web/__tests__/unit/csv-parser.test.ts`
  - Expected: CSV 텍스트 → 파싱된 아이템 배열
  - Details:
    - 정상 CSV (name, url, group, memo 컬럼)
    - 빈 행 무시
    - 잘못된 URL 행 에러 표시
    - 중복 URL 감지

- [ ] **Test 2.3**: Upload CSV API 통합 테스트
  - File: `apps/web/__tests__/integration/api/items-upload.test.ts`
  - Expected: POST /api/items/upload-csv → 아이템 생성 + 중복 제거
  - Details:
    - 정상 업로드 → 201 + 생성된 아이템 수
    - 중복 URL → 기존 아이템 유지 (dedupe)
    - 잘못된 CSV → 400 에러
    - 빈 파일 → 400 에러

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 2.4**: URL 정규화 유틸리티 구현
  - File: `packages/db/src/url-normalization.ts`
  - Details:
    - `normalizeUrl(rawUrl: string): { url: string, dedupeKey: string, productId: string, itemId: string, vendorItemId: string }`
    - URL 파싱 → 불필요 파라미터 제거 → canonical 재조합

- [ ] **Task 2.5**: CSV 파싱 서비스 구현
  - File: `apps/web/lib/csv-parser.ts`
  - Details:
    - papaparse로 CSV 텍스트 파싱
    - 행별 검증 (URL 유효성, 필수 필드)
    - 정규화 + 중복 검출 결과 반환

- [ ] **Task 2.6**: Upload CSV API 엔드포인트 구현
  - File: `apps/web/app/api/items/upload-csv/route.ts`
  - Details:
    - FormData/텍스트 바디에서 CSV 추출
    - csv-parser로 파싱
    - URL 정규화 후 DB upsert (dedupeKey 기준)
    - 결과 응답 (created, skipped, errors)

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 2.7**: 리팩터링
  - Checklist:
    - [ ] URL 정규화 에러 메시지 개선
    - [ ] CSV 파싱 에러 리포팅 구조화
    - [ ] 공통 타입 정의 정리

#### Quality Gate ✋

**⚠️ STOP: Do NOT proceed to Phase 3 until ALL checks pass**

**TDD Compliance**:
- [ ] Tests written FIRST and initially failed
- [ ] Production code makes tests pass
- [ ] Code improved while tests stay green
- [ ] URL normalization coverage ≥90%
- [ ] CSV parser coverage ≥80%

**Build & Tests**:
- [ ] `pnpm build` 성공
- [ ] `pnpm test` 모든 테스트 통과

**Code Quality**:
- [ ] `pnpm lint` 에러 없음
- [ ] TypeScript 컴파일 에러 없음

**Validation Commands**:
```bash
pnpm build
pnpm test
pnpm test -- --coverage
pnpm lint
```

**Manual Test Checklist**:
- [ ] curl/Postman으로 CSV 업로드 → 아이템 생성 확인
- [ ] 동일 CSV 재업로드 → 중복 생성 안 됨 확인
- [ ] 잘못된 URL 포함 CSV → 에러 행 리포팅 확인

---

### Phase 3: Items API & Price Computation
**Goal**: `GET /api/items` (computed stats), `GET /api/items/:id` (variants + snapshots), 7D/30D 최저가 계산
**Status**: ✅ Complete

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 3.1**: 가격 최저가 계산 단위 테스트
  - File: `apps/web/__tests__/unit/price-calculation.test.ts`
  - Expected: Snapshot 배열 → current_low, low_7d, low_30d 계산
  - Details:
    - 빈 스냅샷 → null 반환
    - 7일 이내 스냅샷만 → low_7d 계산
    - 30일 범위 스냅샷 → low_30d 계산
    - 여러 옵션 중 최저가 선택

- [ ] **Test 3.2**: GET /api/items 통합 테스트
  - File: `apps/web/__tests__/integration/api/items-list.test.ts`
  - Expected: 아이템 목록 + computed stats 반환
  - Details:
    - 아이템 0개 → 빈 배열
    - 아이템 + 스냅샷 → current_low, low_7d, low_30d, status 포함
    - last_checked_at 최신 스냅샷 시간

- [ ] **Test 3.3**: GET /api/items/:id 통합 테스트
  - File: `apps/web/__tests__/integration/api/items-detail.test.ts`
  - Expected: 아이템 상세 + variants + 30일 snapshots
  - Details:
    - 존재하는 아이템 → 200 + 상세 데이터
    - 존재하지 않는 ID → 404
    - Variants 배열 + 각 variant의 최신 가격

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 3.4**: 가격 계산 서비스 구현
  - File: `apps/web/lib/price-calculation.ts`
  - Details:
    - `computeItemStats(itemId)`: DB에서 스냅샷 조회 → 통계 계산
    - current_low: 가장 최근 스냅샷 중 최저가
    - low_7d: 7일 이내 최저가
    - low_30d: 30일 이내 최저가
    - lowest_variant: 최저가 옵션 키

- [ ] **Task 3.5**: GET /api/items 엔드포인트 구현
  - File: `apps/web/app/api/items/route.ts`
  - Details:
    - 전체 아이템 목록 조회
    - 각 아이템별 computed stats 포함
    - status 결정 (OK, SOLD_OUT 등 최근 스냅샷 기준)

- [ ] **Task 3.6**: GET /api/items/:id 엔드포인트 구현
  - File: `apps/web/app/api/items/[id]/route.ts`
  - Details:
    - 아이템 + variants + 30일 스냅샷 조회
    - 각 variant별 최신 가격 및 상태

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 3.7**: 리팩터링
  - Checklist:
    - [ ] 가격 계산 쿼리 최적화 (N+1 방지)
    - [ ] 응답 타입 정의 통일
    - [ ] 공통 에러 핸들링 미들웨어

#### Quality Gate ✋

**⚠️ STOP: Do NOT proceed to Phase 4 until ALL checks pass**

**TDD Compliance**:
- [ ] Tests written FIRST and initially failed
- [ ] Production code makes tests pass
- [ ] Price calculation coverage ≥90%
- [ ] API endpoint coverage ≥70%

**Build & Tests**:
- [ ] `pnpm build` 성공
- [ ] `pnpm test` 모든 테스트 통과

**Validation Commands**:
```bash
pnpm build
pnpm test
pnpm test -- --coverage
pnpm lint
```

**Manual Test Checklist**:
- [ ] GET /api/items → 아이템 목록 + 통계 데이터 확인
- [ ] GET /api/items/:id → 상세 + variants + snapshots 확인
- [ ] 스냅샷 없는 아이템 → null 통계로 정상 응답

---

### Phase 4: Job Queue API
**Goal**: `POST /api/jobs/enqueue`, `GET /api/jobs/next` (X-API-KEY 인증, 단일 동시성)
**Status**: ✅ Complete

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 4.1**: Job enqueue 통합 테스트
  - File: `apps/web/__tests__/integration/api/jobs-enqueue.test.ts`
  - Expected: POST /api/jobs/enqueue → Job 레코드 생성
  - Details:
    - mode: "all" → 모든 아이템에 대해 Job 생성
    - mode: "selected" + itemIds → 선택된 아이템만 Job 생성
    - reason: "manual" / "scheduled" 구분
    - 중복 PENDING Job 방지

- [ ] **Test 4.2**: Job next 통합 테스트
  - File: `apps/web/__tests__/integration/api/jobs-next.test.ts`
  - Expected: GET /api/jobs/next → 다음 PENDING Job 반환 + 상태 변경
  - Details:
    - X-API-KEY 헤더 없음 → 401
    - 잘못된 API Key → 401
    - PENDING Job 있음 → Job 반환 + 아이템 URL 포함
    - PENDING Job 없음 → 204 No Content
    - 동시 요청 → 하나만 할당 (단일 동시성)

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 4.3**: Job enqueue 엔드포인트 구현
  - File: `apps/web/app/api/jobs/enqueue/route.ts`
  - Details:
    - 요청 바디 검증 (itemIds, mode, reason)
    - mode=all: 전체 아이템 조회 → Job 생성
    - mode=selected: itemIds로 필터 → Job 생성
    - 이미 PENDING인 아이템은 중복 생성 방지

- [ ] **Task 4.4**: Job next 엔드포인트 구현
  - File: `apps/web/app/api/jobs/next/route.ts`
  - Details:
    - X-API-KEY 헤더 검증 (EXTENSION_API_KEY 환경변수와 비교)
    - PENDING 상태 Job 중 scheduledFor 순 정렬 → 첫 번째
    - 해당 Job + Item 정보 (url, variantCursor) 반환
    - 반환과 동시에 상태를 처리 중으로 관리

- [ ] **Task 4.5**: API Key 인증 미들웨어
  - File: `apps/web/lib/auth.ts`
  - Details:
    - `validateApiKey(request): boolean`
    - X-API-KEY 헤더 추출 → EXTENSION_API_KEY 비교

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 4.6**: 리팩터링
  - Checklist:
    - [ ] Job 상태 전이 로직 명확화
    - [ ] 에러 응답 형식 통일
    - [ ] 타입 안전성 강화

#### Quality Gate ✋

**⚠️ STOP: Do NOT proceed to Phase 5 until ALL checks pass**

**TDD Compliance**:
- [ ] Tests written FIRST and initially failed
- [ ] Production code makes tests pass
- [ ] 인증 로직 coverage ≥80%
- [ ] API endpoint coverage ≥70%

**Build & Tests**:
- [ ] `pnpm build` 성공
- [ ] `pnpm test` 모든 테스트 통과

**Validation Commands**:
```bash
pnpm build
pnpm test
pnpm test -- --coverage
pnpm lint
```

**Manual Test Checklist**:
- [ ] POST /api/jobs/enqueue mode=all → 전체 아이템 Job 생성
- [ ] GET /api/jobs/next (유효 키) → Job + 아이템 URL 반환
- [ ] GET /api/jobs/next (키 없음) → 401

---

### Phase 5: Snapshot Ingestion & Price Events
**Goal**: `POST /api/snapshots/batch`, PriceEvent 감지 (7D/30D 신저가), Slack 웹훅 알림
**Status**: ✅ Complete

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 5.1**: Snapshot batch 통합 테스트
  - File: `apps/web/__tests__/integration/api/snapshots-batch.test.ts`
  - Expected: POST /api/snapshots/batch → Snapshot + Variant 생성/업데이트
  - Details:
    - 새 옵션키 → Variant 자동 생성 + Snapshot 저장
    - 기존 옵션키 → 기존 Variant에 Snapshot 추가
    - variantCursor 업데이트 확인
    - Job 상태 DONE으로 업데이트
    - 잘못된 데이터 → 400 에러

- [ ] **Test 5.2**: PriceEvent 감지 단위 테스트
  - File: `apps/web/__tests__/unit/price-event.test.ts`
  - Expected: 신저가 감지 → PriceEvent 생성
  - Details:
    - 7일 내 최저가 갱신 → period="7d" PriceEvent
    - 30일 내 최저가 갱신 → period="30d" PriceEvent
    - 최저가 아닌 경우 → PriceEvent 미생성
    - 첫 스냅샷 → PriceEvent 미생성 (비교 대상 없음)

- [ ] **Test 5.3**: Slack 알림 단위 테스트
  - File: `apps/web/__tests__/unit/slack-alert.test.ts`
  - Expected: PriceEvent → Slack webhook POST 호출
  - Details:
    - SLACK_WEBHOOK_URL 설정됨 → webhook 호출
    - SLACK_WEBHOOK_URL 미설정 → 스킵 (에러 아님)
    - 메시지 포맷 검증 (아이템명, 옵션, 이전가, 신저가, 기간)

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 5.4**: Snapshot batch 엔드포인트 구현
  - File: `apps/web/app/api/snapshots/batch/route.ts`
  - Details:
    - X-API-KEY 인증
    - 요청 바디: { item_id, url, results[], page_status_code, checked_at }
    - results 순회: Variant upsert + Snapshot 생성
    - Item.variantCursor 업데이트
    - Job 상태 DONE 업데이트

- [ ] **Task 5.5**: PriceEvent 감지 서비스 구현
  - File: `apps/web/lib/price-event.ts`
  - Details:
    - `detectPriceEvents(variantId, newPrice, checkedAt)`: 7D/30D 이전 최저가 조회 → 비교 → PriceEvent 생성
    - Snapshot batch 처리 후 각 variant에 대해 호출

- [ ] **Task 5.6**: Slack 알림 서비스 구현
  - File: `apps/web/lib/slack-alert.ts`
  - Details:
    - `sendSlackAlert(event: PriceEvent)`: webhook URL로 POST
    - 메시지 포맷: 아이템명, 옵션키, 이전 최저가 → 신저가, 기간(7d/30d)
    - SLACK_WEBHOOK_URL 미설정 시 graceful skip

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 5.7**: 리팩터링
  - Checklist:
    - [ ] Snapshot batch 트랜잭션 처리
    - [ ] PriceEvent 감지 쿼리 최적화
    - [ ] 에러 핸들링 강화 (partial failure 처리)

#### Quality Gate ✋

**⚠️ STOP: Do NOT proceed to Phase 6 until ALL checks pass**

**TDD Compliance**:
- [ ] Tests written FIRST and initially failed
- [ ] Production code makes tests pass
- [ ] Snapshot batch coverage ≥80%
- [ ] PriceEvent detection coverage ≥90%

**Build & Tests**:
- [ ] `pnpm build` 성공
- [ ] `pnpm test` 모든 테스트 통과

**Validation Commands**:
```bash
pnpm build
pnpm test
pnpm test -- --coverage
pnpm lint
```

**Manual Test Checklist**:
- [ ] POST /api/snapshots/batch → Snapshot + Variant 생성 확인
- [ ] 신저가 스냅샷 → PriceEvent 레코드 생성 확인
- [ ] Slack 알림 수신 확인 (webhook 설정 시)

---

### Phase 6: Chrome Extension (MV3)
**Goal**: manifest.json, service worker (잡 폴링), content script (DOM 가격 추출), 옵션 라운드로빈, 배치 업로드
**Status**: ✅ Complete

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 6.1**: DOM 가격 추출 단위 테스트
  - File: `apps/extension/__tests__/price-extraction.test.ts`
  - Expected: HTML 문자열 → 가격 추출
  - Details:
    - "쿠팡판매가" 라벨 있음 → 해당 가격 추출
    - "쿠팡판매가" 없음 → 최종 표시가 추출
    - 단위가격 ("100g당") 제외
    - 쿠폰 할인 금액 제외
    - 품절 페이지 → SOLD_OUT 상태

- [ ] **Test 6.2**: 옵션 키 생성 단위 테스트
  - File: `apps/extension/__tests__/option-parser.test.ts`
  - Expected: 선택된 옵션 조합 → option_key 문자열
  - Details:
    - 단일 옵션 그룹 → "3kg"
    - 복수 옵션 그룹 → "3kg / 1개"
    - 옵션 없는 상품 → "default"

- [ ] **Test 6.3**: 잡 폴링 로직 단위 테스트
  - File: `apps/extension/__tests__/job-poller.test.ts`
  - Expected: API 폴링 → 잡 수신 → 처리 → 결과 업로드
  - Details:
    - 잡 있음 → 페이지 열기 + 스크래핑 트리거
    - 잡 없음 → 대기 후 재폴링
    - API 에러 → 재시도 로직

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 6.4**: Extension manifest 및 구조 설정
  - Files: `apps/extension/manifest.json`, `apps/extension/package.json`, `apps/extension/tsconfig.json`
  - Details:
    - MV3 manifest (permissions: tabs, activeTab, storage)
    - Service worker 등록
    - Content script 등록 (coupang.com 매칭)

- [ ] **Task 6.5**: Content Script — DOM 가격 추출 구현
  - File: `apps/extension/src/content/price-extractor.ts`
  - Details:
    - SCRAPER_RULES.md 기반 가격 추출
    - Priority A: "쿠팡판매가" 라벨 → 연관 가격
    - Priority B: 최종 표시가 (단위가/쿠폰 제외)
    - 상태 코드 판별 (OK, SOLD_OUT, FAIL_SELECTOR, BLOCK_SUSPECT)

- [ ] **Task 6.6**: Content Script — 옵션 순회 구현
  - File: `apps/extension/src/content/option-iterator.ts`
  - Details:
    - 옵션 그룹 감지 ("개당 × 수량" 패턴)
    - 클릭 → 300-800ms debounce → 가격 캡처
    - round-robin cursor로 N개 variant 순회
    - option_key 조합 생성

- [ ] **Task 6.7**: Service Worker — 잡 폴링 + 탭 관리
  - File: `apps/extension/src/background/service-worker.ts`
  - Details:
    - GET /api/jobs/next 폴링 (X-API-KEY 헤더)
    - 새 탭 열기 → content script 주입 대기
    - 결과 수신 → POST /api/snapshots/batch
    - 20s PAGE_TIMEOUT_MS 타임아웃 처리
    - 동시성=1 (한 번에 하나의 탭만)

- [ ] **Task 6.8**: Extension 설정 UI (Popup)
  - File: `apps/extension/src/popup/popup.html`, `popup.ts`
  - Details:
    - API Base URL 입력
    - API Key 입력
    - 폴링 상태 표시 (대기중/스크래핑중)
    - Start/Stop 토글

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 6.9**: 리팩터링
  - Checklist:
    - [ ] 가격 추출 로직 에지 케이스 보강
    - [ ] 메시지 패싱 구조 정리 (background ↔ content)
    - [ ] 에러 복구 로직 강화

#### Quality Gate ✋

**⚠️ STOP: Do NOT proceed to Phase 7 until ALL checks pass**

**TDD Compliance**:
- [ ] Tests written FIRST and initially failed
- [ ] Production code makes tests pass
- [ ] DOM 추출 로직 coverage ≥80%

**Build & Tests**:
- [ ] Extension 빌드 성공
- [ ] 단위 테스트 모두 통과

**Validation Commands**:
```bash
cd apps/extension && pnpm build
cd apps/extension && pnpm test
```

**Manual Test Checklist**:
- [ ] Chrome에 Extension 로드 (개발자 모드)
- [ ] Popup에서 API URL/Key 설정
- [ ] 잡 생성 후 Extension이 자동 폴링 → 페이지 열기 → 가격 추출 확인
- [ ] 추출된 스냅샷이 서버 DB에 저장 확인
- [ ] 20s 타임아웃 초과 시 TIMEOUT 상태 확인

---

### Phase 7: Dashboard UI
**Goal**: 아이템 목록 (통계 테이블), 아이템 상세 (가격 추세 차트), CSV 업로드 폼, 수동 새로고침
**Status**: ✅ Complete

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 7.1**: 대시보드 페이지 컴포넌트 테스트
  - File: `apps/web/__tests__/integration/ui/dashboard.test.tsx`
  - Expected: 아이템 목록 렌더링 + 통계 표시
  - Details:
    - 아이템 테이블 렌더링 (name, current_low, low_7d, low_30d, status)
    - 로딩 상태 표시
    - 빈 목록 → 안내 메시지

- [ ] **Test 7.2**: 아이템 상세 페이지 테스트
  - File: `apps/web/__tests__/integration/ui/item-detail.test.tsx`
  - Expected: 가격 추세 차트 + 옵션 테이블 렌더링
  - Details:
    - 30일 가격 추세 차트 데이터 정확성
    - Variants 테이블 (optionKey, 최신 가격, 상태)

- [ ] **Test 7.3**: CSV 업로드 폼 테스트
  - File: `apps/web/__tests__/integration/ui/csv-upload.test.tsx`
  - Expected: 파일 선택 → 업로드 → 결과 표시
  - Details:
    - 파일 선택 UI 작동
    - 업로드 성공 → 생성/스킵 수 표시
    - 업로드 실패 → 에러 표시

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 7.4**: 대시보드 페이지 구현
  - File: `apps/web/app/page.tsx`, `apps/web/app/components/ItemTable.tsx`
  - Details:
    - GET /api/items 호출 → 테이블 렌더링
    - 컬럼: 상품명, 현재 최저가, 7D 최저가, 30D 최저가, 최저 옵션, 상태, 최종 확인
    - 상태별 색상 표시 (OK=green, SOLD_OUT=gray, FAIL=red)
    - 아이템 클릭 → 상세 페이지 이동

- [ ] **Task 7.5**: 아이템 상세 페이지 구현
  - File: `apps/web/app/items/[id]/page.tsx`, `apps/web/app/components/PriceChart.tsx`, `apps/web/app/components/VariantTable.tsx`
  - Details:
    - GET /api/items/:id 호출
    - chart.js로 30일 가격 추세 라인 차트
    - Variants 테이블 (옵션별 현재가, 상태)
    - 뒤로가기 네비게이션

- [ ] **Task 7.6**: CSV 업로드 폼 구현
  - File: `apps/web/app/components/CsvUpload.tsx`
  - Details:
    - 파일 입력 또는 드래그&드롭
    - POST /api/items/upload-csv 호출
    - 결과 표시 (created, skipped, errors)
    - 업로드 후 아이템 목록 새로고침

- [ ] **Task 7.7**: 수동 새로고침 버튼 구현
  - File: `apps/web/app/components/RefreshButton.tsx`
  - Details:
    - "전체 새로고침" 버튼 → POST /api/jobs/enqueue { mode: "all", reason: "manual" }
    - 선택 새로고침 (체크박스 + 버튼) → POST /api/jobs/enqueue { mode: "selected", itemIds, reason: "manual" }
    - 요청 중 로딩 상태

- [ ] **Task 7.8**: 레이아웃 및 네비게이션
  - File: `apps/web/app/layout.tsx`
  - Details:
    - 헤더 (PriceWatch 로고/타이틀)
    - 기본 레이아웃 (반응형)
    - 전역 스타일 (Tailwind CSS 또는 CSS Modules)

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 7.9**: 리팩터링
  - Checklist:
    - [ ] 컴포넌트 분리 및 재사용성 개선
    - [ ] 로딩/에러 상태 UX 통일
    - [ ] 접근성 기본 사항 충족

#### Quality Gate ✋

**⚠️ STOP: Final quality gate before MVP completion**

**TDD Compliance**:
- [ ] Tests written FIRST and initially failed
- [ ] Production code makes tests pass
- [ ] 주요 UI 플로우 통합 테스트 통과

**Build & Tests**:
- [ ] `pnpm build` 성공
- [ ] `pnpm test` 모든 테스트 통과

**Validation Commands**:
```bash
pnpm build
pnpm test
pnpm lint
```

**Manual Test Checklist**:
- [ ] 대시보드에서 아이템 목록 + 통계 확인
- [ ] 아이템 클릭 → 상세 페이지 + 차트 + 옵션 테이블
- [ ] CSV 업로드 → 아이템 생성 → 목록에 반영
- [ ] 수동 새로고침 → Job 생성 확인
- [ ] 전체 E2E: CSV 업로드 → 새로고침 → Extension 스크래핑 → 대시보드 가격 표시 → 신저가 시 Slack 알림

---

## ⚠️ Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| 쿠팡 DOM 구조 변경 | Medium | High | 다중 휴리스틱 전략 사용; 셀렉터 실패 시 FAIL_SELECTOR 상태로 감지 |
| 쿠팡 접근 차단 (captcha/block) | Medium | High | 단일 동시성 + 300-800ms 딜레이; BLOCK_SUSPECT 상태로 감지 |
| Supabase 무료 티어 제한 | Low | Medium | 100개 아이템 × 15 variants × 하루 수회 = 충분한 여유 |
| Extension MV3 서비스워커 수명 | Medium | Medium | 알람 API로 주기적 wake-up; 상태 chrome.storage에 저장 |
| 옵션 조합 폭발 (수백 개) | Low | Low | round-robin cursor + N-per-run으로 분산 수집 |
| Vercel 서버리스 타임아웃 | Low | Medium | API는 경량 DB 쿼리만 수행; 무거운 작업 없음 |

---

## 🔄 Rollback Strategy

### If Phase 1 Fails
- 생성된 패키지 구조 삭제
- DB 마이그레이션 롤백: `pnpm prisma migrate reset`

### If Phase 2 Fails
- `apps/web/app/api/items/upload-csv/` 라우트 삭제
- `packages/db/src/url-normalization.ts` 삭제
- `apps/web/lib/csv-parser.ts` 삭제

### If Phase 3 Fails
- `apps/web/app/api/items/` 라우트 삭제
- `apps/web/lib/price-calculation.ts` 삭제
- Phase 2 상태로 복원

### If Phase 4 Fails
- `apps/web/app/api/jobs/` 라우트 삭제
- `apps/web/lib/auth.ts` 삭제
- Phase 3 상태로 복원

### If Phase 5 Fails
- `apps/web/app/api/snapshots/` 라우트 삭제
- `apps/web/lib/price-event.ts`, `slack-alert.ts` 삭제
- Phase 4 상태로 복원

### If Phase 6 Fails
- `apps/extension/src/` 디렉토리 삭제
- 서버 코드는 Phase 5 상태 유지 (Extension 없이도 API 작동)

### If Phase 7 Fails
- UI 컴포넌트 삭제, API는 Phase 5 상태 유지
- API만으로 기능 검증 가능

---

## 📊 Progress Tracking

### Completion Status
- **Phase 1**: ✅ 100%
- **Phase 2**: ✅ 100%
- **Phase 3**: ✅ 100%
- **Phase 4**: ✅ 100%
- **Phase 5**: ✅ 100%
- **Phase 6**: ✅ 100%
- **Phase 7**: ✅ 100%

**Overall Progress**: 100% complete

---

## 📝 Notes & Learnings

### Implementation Notes
- (Phase 진행 중 추가)

### Blockers Encountered
- (발생 시 추가)

### Improvements for Future Plans
- (완료 후 추가)

---

## 📚 References

### Documentation
- [AGENTS.md](../../AGENTS.md) — 프로젝트 목표, MVP 정의
- [API_SPEC.md](../../API_SPEC.md) — REST API 스펙
- [SCRAPER_RULES.md](../../SCRAPER_RULES.md) — DOM 가격 추출 규칙
- [EXTENSION_NOTES.md](../../EXTENSION_NOTES.md) — DOM 전략 노트
- [URL_NORMALIZATION.md](../../URL_NORMALIZATION.md) — URL 정규화 규칙
- [packages/db/schema.prisma](../../packages/db/schema.prisma) — 데이터베이스 스키마

---

## ✅ Final Checklist

**Before marking plan as COMPLETE**:
- [ ] All 7 phases completed with quality gates passed
- [ ] Full E2E flow tested: CSV → Refresh → Extension scrape → Dashboard → Slack alert
- [ ] All API endpoints tested with curl/Postman
- [ ] Extension loads and operates in Chrome
- [ ] Dashboard displays all data correctly
- [ ] Slack alerts fire on price lows
- [ ] Documentation updated
- [ ] Performance acceptable for 100 items
- [ ] No security vulnerabilities (API key auth, input validation)

---

**Plan Status**: 🔄 In Progress
**Next Action**: Phase 1 — Monorepo Foundation & DB Setup
**Blocked By**: None
