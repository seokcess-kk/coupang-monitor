# PriceWatch

쿠팡 상품 상세 URL 기반 옵션 최저가 모니터링 SaaS (MVP)

## Features
- 옵션별 표시가 수집 → 현재/7D/30D 최저가
- 가격 추이
- 최저가 갱신 시 Slack 알림
- 수동/주기 갱신 (5/10/30/60분)
- 브라우저 에이전트(크롬 확장) 기반 수집

## Quick Start
1) env 설정
2) DB 마이그레이션
3) 웹 실행
4) 크롬 확장 로드(개발자 모드)

## Monorepo Structure
- `apps/web`: Next.js App Router (API + UI)
- `apps/extension`: Chrome Extension (MV3)
- `packages/db`: Prisma schema/migrations

## Local Setup
### 1) Env 설정
```bash
cp .env.example .env
```

### 2) DB 마이그레이션
```bash
pnpm i
pnpm db:migrate
```

### 3) 웹 실행
```bash
pnpm dev
```

### 4) 크롬 확장 설치 (Developer Mode)
1. Chrome → 확장 프로그램 관리
2. 개발자 모드 ON
3. “압축해제된 확장 프로그램 로드” 클릭
4. `apps/extension` 폴더 선택

### 5) 확장 설정
서비스 워커 콘솔에서 API 설정:
```js
chrome.storage.local.set({
  apiBaseUrl: "http://localhost:3000",
  apiKey: "dev_key_change_me"
})
```

## Sample CSV
샘플 CSV는 `samples/sample-items.csv`에 포함되어 있습니다.
```bash
cat samples/sample-items.csv
```

## Env
See `.env.example`

## Notes
- 서버 스크래핑 금지
- 쿠폰/개인혜택 제외, 표시가만 사용
