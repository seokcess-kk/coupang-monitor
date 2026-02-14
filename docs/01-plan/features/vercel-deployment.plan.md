# Plan: Vercel 배포

## 개요

PriceWatch 대시보드(apps/web)를 Vercel에 배포하여 운영 환경을 구축합니다.

## 목표

| 항목 | 목표 |
|------|------|
| **배포 대상** | apps/web (Next.js 대시보드) |
| **플랫폼** | Vercel (무료 Hobby 플랜) |
| **데이터베이스** | Supabase PostgreSQL |
| **가격 수집** | Chrome Extension (기존 방식 유지) |

## 현재 아키텍처 분석

### 배포 가능 컴포넌트

| 컴포넌트 | 설명 | Vercel 호환 |
|----------|------|-------------|
| apps/web | Next.js 15 대시보드 | ✅ |
| packages/db | Prisma ORM | ✅ |
| apps/extension | Chrome Extension | N/A (브라우저) |
| apps/scraper | CDP 스크래퍼 | ❌ (별도 서버 필요) |

### 환경 변수

| 변수 | 용도 | Vercel 설정 |
|------|------|-------------|
| `DATABASE_URL` | PostgreSQL 연결 | ✅ 필수 |
| `SLACK_WEBHOOK_URL` | 알림 발송 | 선택 |
| `EXTENSION_API_KEY` | Extension 인증 | ✅ 필수 |

## 구현 작업

### Task 1: Vercel 프로젝트 설정

- [ ] Vercel 계정 연결
- [ ] GitHub 저장소 연결
- [ ] Root Directory 설정: `apps/web`
- [ ] Build Command: `cd ../.. && pnpm build`
- [ ] Output Directory: `.next`

### Task 2: 환경 변수 설정

- [ ] Supabase DATABASE_URL 설정
- [ ] EXTENSION_API_KEY 설정 (Production용 새 키 생성)
- [ ] SLACK_WEBHOOK_URL 설정 (선택)

### Task 3: Prisma 설정 최적화

- [ ] `prisma generate` 빌드 단계 추가
- [ ] Prisma Client 번들링 설정

### Task 4: Monorepo 빌드 설정

- [ ] `vercel.json` 생성
- [ ] pnpm workspace 지원 설정
- [ ] 의존성 설치 명령 설정

### Task 5: Extension 배포 URL 업데이트

- [ ] Extension의 API URL을 Vercel 도메인으로 변경
- [ ] CORS 설정 확인

## 예상 vercel.json

```json
{
  "buildCommand": "pnpm --filter @pricewatch/db generate && pnpm --filter @pricewatch/web build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs"
}
```

## 배포 후 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  Vercel                                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Next.js Web App                                 │   │
│  │  - Dashboard UI (SSR)                            │   │
│  │  - REST API (Serverless Functions)               │   │
│  │    /api/items, /api/snapshots/batch, etc.        │   │
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
│  사용자 브라우저                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Chrome Extension (MV3)                          │   │
│  │  - 가격 수집 (DOM 읽기)                          │   │
│  │  - Job 폴링 → API 호출                           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 제외 항목 (Vercel 배포 불가)

| 항목 | 이유 | 대안 |
|------|------|------|
| apps/scraper | Chrome/CDP 필요, 장기 실행 | 로컬 PC 또는 Railway |
| 자동 예약 수집 | Serverless 60초 제한 | Vercel Cron (제한적) 또는 Extension 사용 |

## 성공 기준

| 항목 | 기준 |
|------|------|
| 대시보드 접근 | Vercel 도메인에서 정상 로드 |
| API 동작 | /api/items, /api/health 정상 응답 |
| DB 연결 | Supabase 연결 성공 |
| Extension 연동 | Production API로 가격 수집 성공 |

## 예상 배포 URL

- Production: `https://coupang-monitor.vercel.app`
- Preview: `https://coupang-monitor-{branch}.vercel.app`

## 비용

| 항목 | 비용 |
|------|------|
| Vercel Hobby | 무료 |
| Supabase Free | 무료 (500MB DB) |
| **총 비용** | **$0/월** |

## 다음 단계

1. `/pdca design vercel-deployment` - 상세 설계
2. 구현 및 배포
3. Extension 업데이트
