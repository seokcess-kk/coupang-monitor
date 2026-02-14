# Design: Vercel 배포

## 개요

PriceWatch 대시보드를 Vercel에 배포하기 위한 상세 설계 문서입니다.

---

## 1. 배포 구성

### 1.1 Vercel 프로젝트 설정

| 설정 | 값 |
|------|-----|
| **Framework** | Next.js |
| **Root Directory** | `apps/web` |
| **Build Command** | `cd ../.. && pnpm install && pnpm --filter @pricewatch/db generate && pnpm --filter @pricewatch/web build` |
| **Output Directory** | `.next` |
| **Install Command** | `pnpm install` |
| **Node.js Version** | 18.x |

### 1.2 vercel.json 설계

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && pnpm --filter @pricewatch/db generate && pnpm --filter @pricewatch/web build",
  "installCommand": "cd ../.. && pnpm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

**위치**: `apps/web/vercel.json`

---

## 2. 환경 변수

### 2.1 필수 변수

| 변수명 | 용도 | Production 값 |
|--------|------|---------------|
| `DATABASE_URL` | Supabase PostgreSQL | `postgresql://postgres.xxx:xxx@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Prisma Migrate용 | `postgresql://postgres.xxx:xxx@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres` |
| `EXTENSION_API_KEY` | Extension 인증 | (새 키 생성 필요) |

### 2.2 선택 변수

| 변수명 | 용도 | 기본값 |
|--------|------|--------|
| `SLACK_WEBHOOK_URL` | 알림 발송 | (없으면 스킵) |
| `DEFAULT_VARIANT_PER_RUN` | 옵션 수집 수 | `15` |
| `PAGE_TIMEOUT_MS` | 페이지 타임아웃 | `20000` |

---

## 3. Prisma 설정 수정

### 3.1 schema.prisma 수정

```prisma
// packages/db/prisma/schema.prisma

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // 추가: Supabase용
}

generator client {
  provider = "prisma-client-js"
  output   = "../generated/client"  // 수정: 명시적 출력 경로
}
```

### 3.2 Prisma Client 경로 수정

```typescript
// packages/db/src/index.ts

import { PrismaClient } from '../generated/client';
// ... 기존 코드
```

---

## 4. API 경로 설정

### 4.1 CORS 헤더 (필요시)

```typescript
// apps/web/app/api/[...route]/route.ts

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY',
    },
  });
}
```

### 4.2 API 엔드포인트 확인

| 엔드포인트 | 메서드 | Serverless 호환 |
|------------|--------|-----------------|
| `/api/health` | GET | ✅ |
| `/api/items` | GET, POST | ✅ |
| `/api/items/[id]` | GET, PATCH, DELETE | ✅ |
| `/api/items/upload-csv` | POST | ✅ |
| `/api/jobs/enqueue` | POST | ✅ |
| `/api/jobs/next` | GET | ✅ |
| `/api/snapshots/batch` | POST | ✅ |
| `/api/scraper/trigger` | POST | ⚠️ 제거 (로컬 전용) |
| `/api/scraper/progress` | GET | ⚠️ 제거 (로컬 전용) |

---

## 5. Extension 업데이트

### 5.1 API URL 환경 분리

```typescript
// apps/extension/src/config.ts

export const config = {
  // Production Vercel URL
  apiBaseUrl: 'https://coupang-monitor.vercel.app',

  // 또는 환경변수로
  // apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
};
```

### 5.2 manifest.json 권한 추가

```json
{
  "host_permissions": [
    "https://coupang-monitor.vercel.app/*",
    "https://www.coupang.com/*"
  ]
}
```

---

## 6. 배포 순서

### Step 1: Vercel 프로젝트 생성

```bash
# Vercel CLI 설치 (선택)
npm i -g vercel

# 프로젝트 연결
vercel link
```

### Step 2: 환경 변수 설정

Vercel Dashboard → Settings → Environment Variables:

1. `DATABASE_URL` (Production, Preview, Development)
2. `DIRECT_URL` (Production, Preview, Development)
3. `EXTENSION_API_KEY` (Production only)
4. `SLACK_WEBHOOK_URL` (Production only, 선택)

### Step 3: vercel.json 생성

```bash
# apps/web/vercel.json 파일 생성
```

### Step 4: GitHub 푸시 & 자동 배포

```bash
git add .
git commit -m "feat: add Vercel deployment configuration"
git push origin main
```

### Step 5: 배포 확인

1. https://coupang-monitor.vercel.app 접속
2. `/api/health` 응답 확인
3. 대시보드 로드 확인

### Step 6: Extension 업데이트

1. API URL 변경
2. 테스트
3. Chrome Web Store 업데이트 (선택)

---

## 7. 제외 항목

### 7.1 로컬 스크래퍼 API 제거

Production 배포에서 제외할 API:

```
apps/web/app/api/scraper/trigger/route.ts  → 제거 또는 분기
apps/web/app/api/scraper/progress/route.ts → 제거 또는 분기
```

**대안**: 환경변수로 분기 처리

```typescript
// apps/web/app/api/scraper/trigger/route.ts

export async function POST(req: Request) {
  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: 'Scraper not available in production. Use Chrome Extension.' },
      { status: 503 }
    );
  }
  // 기존 로직...
}
```

---

## 8. 검증 체크리스트

| 항목 | 검증 방법 | 예상 결과 |
|------|-----------|-----------|
| 배포 성공 | Vercel Dashboard | Build Success |
| Health Check | `curl /api/health` | `{"status":"ok"}` |
| DB 연결 | `curl /api/items` | JSON 배열 반환 |
| Extension 연동 | Extension에서 Job 폴링 | Job 수신 성공 |
| 가격 수집 | Extension으로 수집 | Snapshot 저장 성공 |

---

## 9. 롤백 계획

배포 실패 시:

1. Vercel Dashboard → Deployments → 이전 버전 선택 → Promote to Production
2. 또는 GitHub에서 revert commit

---

## 10. 구현 파일 목록

| 파일 | 작업 | 우선순위 |
|------|------|----------|
| `apps/web/vercel.json` | 생성 | 필수 |
| `packages/db/prisma/schema.prisma` | 수정 | 필수 |
| `apps/web/app/api/scraper/trigger/route.ts` | 수정 | 권장 |
| `apps/web/app/api/scraper/progress/route.ts` | 수정 | 권장 |
| `apps/extension/src/config.ts` | 수정 | 배포 후 |
| `apps/extension/manifest.json` | 수정 | 배포 후 |

---

## 다음 단계

1. `/pdca do vercel-deployment` - 구현 시작
2. 또는 직접 구현 진행
