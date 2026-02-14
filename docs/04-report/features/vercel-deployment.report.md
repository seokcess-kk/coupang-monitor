# Completion Report: Vercel 배포

## 요약

| 항목 | 내용 |
|------|------|
| **Feature** | vercel-deployment |
| **완료일** | 2026-02-15 |
| **Match Rate** | 100% |
| **Iteration** | 1 (빌드 에러 수정) |

---

## 1. 목표 (Plan)

PriceWatch 대시보드(apps/web)를 Vercel에 배포하여 무료 운영 환경 구축

### 목표 항목

| 항목 | 목표 | 결과 |
|------|------|------|
| 배포 플랫폼 | Vercel (무료) | ✅ 완료 |
| 데이터베이스 | Supabase PostgreSQL | ✅ 연결 |
| 월 비용 | $0 | ✅ 달성 |

---

## 2. 설계 (Design)

### 배포 구성

| 설정 | 값 |
|------|-----|
| Framework | Next.js |
| Root Directory | `apps/web` |
| Build Command | `pnpm --filter @pricewatch/db generate && pnpm --filter @pricewatch/web build` |
| Node.js Version | 18.x |

### 환경 변수

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | Supabase Pooler 연결 |
| `DIRECT_URL` | Prisma Migrate용 |
| `EXTENSION_API_KEY` | Extension 인증 |

---

## 3. 구현 내용 (Do)

### 3.1 vercel.json 생성

**파일**: `apps/web/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && pnpm --filter @pricewatch/db generate && pnpm --filter @pricewatch/web build",
  "installCommand": "cd ../.. && pnpm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### 3.2 Prisma Schema 수정

**파일**: `packages/db/prisma/schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // Supabase용 추가
}
```

### 3.3 Scraper API Production 분기

**파일**: `apps/web/app/api/scraper/trigger/route.ts`

```typescript
export async function POST(req: Request) {
  // Production(Vercel)에서는 로컬 스크래퍼 사용 불가
  if (process.env.VERCEL) {
    return NextResponse.json({
      error: 'Scraper not available in production. Use Chrome Extension.',
    }, { status: 503 });
  }
  // ... 로컬 스크래퍼 로직
}
```

### 3.4 빌드 에러 수정

**문제**: Dashboard.tsx에서 RefreshButton에 불필요한 props 전달

```diff
- <RefreshButton
-   onCrawlStart={startPolling}
-   showToast={showToast}
- />
+ <RefreshButton />
```

---

## 4. 검증 결과 (Check)

### 배포 성공

| 항목 | 상태 |
|------|------|
| Vercel 빌드 | ✅ 성공 |
| 대시보드 로드 | ✅ 정상 |
| API 응답 | ✅ 정상 |
| DB 연결 | ✅ 성공 |

### Match Rate: 100%

| Task | 계획 항목 | 구현 항목 | 비율 |
|------|----------|----------|------|
| vercel.json | 1 | 1 | 100% |
| Prisma 설정 | 1 | 1 | 100% |
| API 분기 | 2 | 2 | 100% |
| 환경 변수 | 3 | 3 | 100% |
| **총합** | 7 | 7 | **100%** |

---

## 5. 최종 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  Vercel (Production)                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Next.js 15 Web App                              │   │
│  │  - Dashboard UI (SSR)                            │   │
│  │  - REST API (Serverless Functions)               │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase                                               │
│  - PostgreSQL Database                                  │
│  - Connection Pooling (PgBouncer)                       │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────┐
│  사용자 환경                                             │
│  ├─ Chrome Extension: 가격 수집 (Production)            │
│  └─ 로컬 스크래퍼: 가격 수집 (Development)               │
└─────────────────────────────────────────────────────────┘
```

---

## 6. 변경 파일 목록

| 파일 | 변경 유형 |
|------|----------|
| `apps/web/vercel.json` | 생성 |
| `packages/db/prisma/schema.prisma` | 수정 |
| `apps/web/app/api/scraper/trigger/route.ts` | 수정 |
| `apps/web/app/api/scraper/progress/route.ts` | 수정 |
| `apps/web/app/components/Dashboard.tsx` | 수정 |
| `.env.example` | 수정 |

---

## 7. 커밋 이력

| 커밋 | 메시지 |
|------|--------|
| `2b53615` | feat: add Vercel deployment configuration |
| `63d092b` | fix: remove unused props from RefreshButton in Dashboard |

---

## 8. 비용 분석

| 항목 | 월 비용 |
|------|---------|
| Vercel Hobby | $0 |
| Supabase Free | $0 |
| **총 비용** | **$0/월** |

---

## 9. 결론

### 핵심 성과

1. **무료 배포 완료** - Vercel + Supabase 조합으로 $0/월 운영
2. **Monorepo 빌드 설정** - pnpm workspace 기반 빌드 구성
3. **환경 분리** - Production/Development 스크래퍼 API 분기

### 운영 가이드

| 환경 | 가격 수집 방법 |
|------|----------------|
| Production (Vercel) | Chrome Extension 사용 |
| Development (로컬) | 로컬 스크래퍼 서버 사용 |

### 향후 개선 사항

1. **Chrome Extension 업데이트** - API URL을 Vercel 도메인으로 변경
2. **Vercel Cron** - 예약 작업 설정 (선택)
3. **커스텀 도메인** - 필요시 도메인 연결
