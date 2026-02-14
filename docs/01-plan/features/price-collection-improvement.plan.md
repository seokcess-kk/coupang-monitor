# Plan: 가격 수집 방식 개선 (로컬 무료 버전)

**Feature**: price-collection-improvement
**Status**: Draft (Updated)
**Created**: 2026-02-14
**Updated**: 2026-02-14
**Author**: Claude (AI Assistant)

---

## 1. 현재 상황 분석

### 1.1 현재 문제점
| 문제 | 심각도 |
|------|--------|
| Extension 설치/관리 번거로움 | HIGH |
| PC가 켜져 있어야만 동작 | HIGH |
| 수집 속도 느림 (100개 ≈ 37분) | HIGH |
| 단일 탭 처리 (concurrency=1) | MEDIUM |

### 1.2 사용자 요구사항 (업데이트)
- **로컬 환경**에서 운영 (클라우드 비용 없음)
- **특정 시간대**에만 수집 (예: 출근 전, 퇴근 후)
- **수동 수집 기능** - 원하는 시점에 즉시 수집 가능
- **무료** 솔루션 선호
- 향후 500개 상품까지 확장 가능

---

## 2. 무료 로컬 솔루션 비교

### 2.1 Option A: 로컬 Puppeteer 서비스 ⭐ 권장

```
[로컬 PC]
    └── Node.js 서비스 (백그라운드)
          ├── Puppeteer (설치된 Chrome 사용)
          ├── 스케줄러 (node-cron 또는 Windows Task Scheduler)
          └── 기존 API 연동
```

**장점:**
- **완전 무료** (프록시 없이도 가능)
- Extension 설치 불필요
- 병렬 처리 가능 (3-5개 동시)
- 기존 가격 추출 로직 재사용
- Windows/Mac/Linux 모두 지원

**단점:**
- PC가 켜져 있어야 함 (특정 시간대만 OK)
- Chrome이 백그라운드에서 실행됨

**비용: $0/월**

### 2.2 Option B: Extension 병렬화 개선

```
[현재 Extension]
    └── 단일 탭 → 다중 탭 (3-5개)
    └── 재시도 로직 강화
```

**장점:**
- 기존 코드 최소 수정
- 즉시 적용 가능

**단점:**
- 여전히 Extension 관리 필요
- Chrome 브라우저 창 필요

**비용: $0/월**

### 2.3 Option C: PM2 + Puppeteer (추천 조합)

```
[로컬 PC]
    └── PM2 (프로세스 매니저)
          └── Puppeteer 서비스
                ├── 자동 재시작
                ├── 로그 관리
                └── 스케줄 기반 실행
```

**장점:**
- 프로세스 안정성 (크래시 시 자동 재시작)
- 로그 관리 편리
- 시스템 시작 시 자동 실행 가능

**비용: $0/월**

---

## 3. 권장 방안: Option A + C (로컬 Puppeteer + PM2)

### 3.1 선정 이유

| 기준 | Extension | 로컬 Puppeteer | PM2 조합 |
|------|-----------|----------------|----------|
| 비용 | 무료 | **무료** | **무료** |
| 설치 편의성 | 낮음 | **높음** | **높음** |
| 수집 속도 | 느림 | **빠름** | **빠름** |
| 안정성 | 중 | 중 | **높음** |
| 스케줄링 | 수동 | **자동** | **자동** |

### 3.2 아키텍처 설계

```
┌─────────────────────────────────────────────────────────────────┐
│                         로컬 PC (Windows)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    PM2 Process Manager                     │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Scraper Service (Node.js)               │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │  │
│  │  │  │Browser #1│ │Browser #2│ │Browser #3│            │  │  │
│  │  │  │(headless)│ │(headless)│ │(headless)│            │  │  │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘            │  │  │
│  │  │       └────────────┼────────────┘                   │  │  │
│  │  │                    │                                 │  │  │
│  │  │            ┌───────▼───────┐                        │  │  │
│  │  │            │ puppeteer-    │                        │  │  │
│  │  │            │ cluster       │                        │  │  │
│  │  │            └───────┬───────┘                        │  │  │
│  │  │                    │                                 │  │  │
│  │  │            ┌───────▼───────┐                        │  │  │
│  │  │            │ node-cron     │                        │  │  │
│  │  │            │ Scheduler     │                        │  │  │
│  │  │            └───────────────┘                        │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │ HTTP                              │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   기존 Next.js 서버                        │  │
│  │          (localhost:3000 또는 Vercel 배포)                 │  │
│  │  ┌──────────────────┐  ┌──────────────────┐              │  │
│  │  │ POST /api/       │  │ GET /api/items   │              │  │
│  │  │ snapshots/batch  │  │ Dashboard        │              │  │
│  │  └──────────────────┘  └──────────────────┘              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              PostgreSQL (Docker 또는 Supabase)             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 프로젝트 구조

```
apps/
  scraper/                      # 새로운 로컬 스크래퍼
    ├── package.json
    ├── tsconfig.json
    ├── ecosystem.config.js     # PM2 설정
    ├── src/
    │   ├── index.ts            # 엔트리포인트
    │   ├── cluster.ts          # puppeteer-cluster 설정
    │   ├── scraper.ts          # 가격 추출 (extension 코드 포팅)
    │   ├── scheduler.ts        # node-cron 스케줄러
    │   ├── config.ts           # 스케줄/동시성 설정
    │   └── api-client.ts       # 기존 API 호출
    └── scripts/
        ├── start.bat           # Windows 시작 스크립트
        └── start.sh            # Mac/Linux 시작 스크립트
```

---

## 4. 구현 계획

### Phase 1: 핵심 스크래퍼 (1-2일)

#### 1.1 의존성 설치
```bash
cd apps/scraper
pnpm add puppeteer puppeteer-cluster node-cron
pnpm add -D @types/node typescript
```

#### 1.2 핵심 파일 구현

**cluster.ts** - 브라우저 풀 관리:
```typescript
import { Cluster } from 'puppeteer-cluster';

export async function createCluster() {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 3,  // 3개 브라우저 동시 실행
    puppeteerOptions: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
    timeout: 30000,
  });

  return cluster;
}
```

**scraper.ts** - 가격 추출 (기존 Extension 로직 포팅):
```typescript
import { Page } from 'puppeteer';

export async function scrapePrices(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'networkidle2' });

  // 기존 price-extractor.ts 로직 재사용
  const price = await page.evaluate(() => {
    // DOM 가격 추출 로직
    const priceEl = document.querySelector('.prod-sale-price strong');
    if (!priceEl) return null;
    return parseInt(priceEl.textContent?.replace(/[^0-9]/g, '') || '0');
  });

  return { price, status: price ? 'OK' : 'FAIL_SELECTOR' };
}
```

**scheduler.ts** - 스케줄 관리:
```typescript
import cron from 'node-cron';
import { runScrapeJob } from './index';

// 매일 오전 7시, 저녁 7시 실행
cron.schedule('0 7,19 * * *', async () => {
  console.log('Starting scheduled scrape...');
  await runScrapeJob();
});

// 또는 더 유연한 설정
export const SCHEDULE_CONFIG = {
  // 평일 출근 전 (7:00 AM)
  weekdayMorning: '0 7 * * 1-5',
  // 평일 퇴근 후 (7:00 PM)
  weekdayEvening: '0 19 * * 1-5',
  // 주말 (2시간마다)
  weekend: '0 */2 * * 0,6',
};
```

### Phase 2: PM2 설정 및 자동화 (반나절)

**ecosystem.config.js**:
```javascript
module.exports = {
  apps: [{
    name: 'pricewatch-scraper',
    script: './dist/index.js',
    cwd: './apps/scraper',
    watch: false,
    autorestart: true,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      API_BASE_URL: 'http://localhost:3000',
      API_KEY: 'your-extension-api-key',
    },
    // 로그 설정
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/output.log',
  }]
};
```

**Windows 시작 스크립트 (start.bat)**:
```batch
@echo off
cd /d "%~dp0"
pm2 start ecosystem.config.js
pm2 save
echo Scraper started! Check logs with: pm2 logs pricewatch-scraper
```

**Windows 시작프로그램 등록** (선택):
```batch
:: 시작 시 자동 실행
pm2 startup
pm2 save
```

### Phase 3: 성능 최적화 (선택, 반나절)

#### 3.1 차단 회피 (무료 방법)
```typescript
// User-Agent 로테이션 (무료)
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
];

// 요청 간 랜덤 딜레이
await sleep(randomInt(2000, 5000));  // 2-5초
```

#### 3.2 캐싱으로 속도 향상
```typescript
// 옵션 정보 캐싱 (24시간)
const optionCache = new Map<string, OptionInfo>();

async function getOptions(itemId: string) {
  const cached = optionCache.get(itemId);
  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    return cached.options;
  }
  // 캐시 미스 시 DOM에서 추출
  const options = await extractOptionsFromDOM();
  optionCache.set(itemId, { options, timestamp: Date.now() });
  return options;
}
```

---

## 5. 수집 스케줄 예시

### 5.1 시간대별 수집 전략

| 시간대 | 빈도 | 상품 수 | 예상 시간 |
|--------|------|---------|-----------|
| 평일 오전 7시 | 매일 | 전체 100개 | ~10분 |
| 평일 저녁 7시 | 매일 | 전체 100개 | ~10분 |
| 주말 | 2시간마다 | 전체 100개 | ~10분 |

### 5.2 설정 예시 (config.ts)
```typescript
export const CONFIG = {
  // 동시 브라우저 수
  concurrency: 3,

  // 페이지 타임아웃 (ms)
  pageTimeout: 20000,

  // 요청 간 딜레이 (ms)
  minDelay: 2000,
  maxDelay: 5000,

  // 스케줄 (cron 표현식)
  schedules: [
    '0 7 * * *',   // 매일 오전 7시
    '0 19 * * *',  // 매일 저녁 7시
  ],

  // 실패 시 재시도
  maxRetries: 2,
};
```

---

## 6. 예상 성능 비교

| 지표 | 현재 (Extension) | 개선 후 (로컬 Puppeteer) |
|------|------------------|-------------------------|
| 100개 상품 수집 | 37분 | **10-12분** |
| 동시 처리 | 1개 | **3개** |
| 설치 복잡도 | 높음 | **낮음 (npm install)** |
| 스케줄링 | 수동 | **자동 (cron)** |
| Extension 필요 | Yes | **No** |
| 월 비용 | $0 | **$0** |

---

## 7. 구현 순서

### Step 1: 기본 구조 생성 (30분)
```bash
mkdir -p apps/scraper/src
cd apps/scraper
pnpm init
pnpm add puppeteer puppeteer-cluster node-cron
pnpm add -D typescript @types/node
```

### Step 2: 핵심 코드 작성 (2-3시간)
1. `cluster.ts` - 브라우저 풀
2. `scraper.ts` - 가격 추출 (기존 코드 포팅)
3. `api-client.ts` - 기존 API 연동
4. `scheduler.ts` - cron 스케줄러
5. `index.ts` - 메인 엔트리

### Step 3: PM2 설정 (30분)
1. `ecosystem.config.js` 작성
2. `start.bat` 스크립트
3. 테스트 실행

### Step 4: 테스트 및 조정 (1시간)
1. 단일 상품 테스트
2. 전체 상품 테스트
3. 스케줄 테스트

---

## 8. 수동 수집 기능 (추가)

### 8.1 수동 실행 방법

사용자가 원하는 시점에 즉시 수집을 실행할 수 있는 **3가지 방법** 제공:

#### 방법 1: CLI 명령어 (가장 간단)
```bash
# 전체 상품 수집
pnpm scraper:run

# 특정 상품만 수집
pnpm scraper:run --items=123,456,789

# 특정 그룹만 수집
pnpm scraper:run --group="식품"
```

**package.json 스크립트:**
```json
{
  "scripts": {
    "scraper:run": "node dist/cli.js run",
    "scraper:run:all": "node dist/cli.js run --all",
    "scraper:status": "node dist/cli.js status"
  }
}
```

#### 방법 2: 대시보드 버튼 (기존 UI 활용)
```
[대시보드]
    └── "새로고침" 버튼 클릭
          ↓
    POST /api/scraper/trigger   ← 새 API 엔드포인트
          ↓
    Scraper 서비스가 즉시 실행
```

**새 API 엔드포인트:**
```typescript
// apps/web/app/api/scraper/trigger/route.ts
export async function POST(req: Request) {
  const { itemIds, mode } = await req.json();

  // Scraper 서비스에 HTTP 요청 또는 메시지 큐
  await fetch('http://localhost:3001/run', {
    method: 'POST',
    body: JSON.stringify({ itemIds, mode }),
  });

  return Response.json({ status: 'started' });
}
```

#### 방법 3: 바탕화면 바로가기 (Windows)
```batch
:: run-scraper.bat
@echo off
cd /d "C:\path\to\coupang-monitor\apps\scraper"
node dist/cli.js run --all
echo 수집 완료!
pause
```

### 8.2 CLI 구현 상세

**cli.ts:**
```typescript
import { Command } from 'commander';
import { createCluster } from './cluster';
import { runScrapeJob } from './index';

const program = new Command();

program
  .name('pricewatch-scraper')
  .description('쿠팡 가격 수집 CLI')
  .version('1.0.0');

program
  .command('run')
  .description('가격 수집 실행')
  .option('-a, --all', '전체 상품 수집')
  .option('-i, --items <ids>', '특정 상품 ID들 (쉼표 구분)')
  .option('-g, --group <name>', '특정 그룹만 수집')
  .action(async (options) => {
    console.log('🚀 수집 시작...');

    const itemIds = options.items?.split(',') || null;
    const group = options.group || null;

    await runScrapeJob({ itemIds, group, all: options.all });

    console.log('✅ 수집 완료!');
    process.exit(0);
  });

program
  .command('status')
  .description('현재 수집 상태 확인')
  .action(async () => {
    // 마지막 수집 시간, 성공/실패 수 등 표시
    const status = await getScraperStatus();
    console.table(status);
  });

program.parse();
```

### 8.3 Scraper HTTP 서버 (대시보드 연동용)

**server.ts:**
```typescript
import express from 'express';
import { runScrapeJob } from './index';

const app = express();
app.use(express.json());

// 수동 실행 엔드포인트
app.post('/run', async (req, res) => {
  const { itemIds, mode } = req.body;

  // 비동기로 실행 시작 (즉시 응답 반환)
  runScrapeJob({ itemIds, mode }).catch(console.error);

  res.json({ status: 'started', timestamp: new Date().toISOString() });
});

// 상태 확인
app.get('/status', async (req, res) => {
  const status = await getScraperStatus();
  res.json(status);
});

// 현재 진행 상황
app.get('/progress', async (req, res) => {
  const progress = await getCurrentProgress();
  res.json(progress);  // { total: 100, completed: 45, failed: 2 }
});

app.listen(3001, () => {
  console.log('Scraper API running on http://localhost:3001');
});
```

### 8.4 대시보드 UI 개선

기존 "새로고침" 버튼을 Scraper 서비스와 연동:

```typescript
// apps/web/components/RefreshButton.tsx
export function RefreshButton({ itemIds }: { itemIds?: string[] }) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ total: 0, completed: 0 });

  const handleClick = async () => {
    setIsRunning(true);

    // 수집 시작
    await fetch('/api/scraper/trigger', {
      method: 'POST',
      body: JSON.stringify({ itemIds, mode: 'manual' }),
    });

    // 진행 상황 폴링
    const interval = setInterval(async () => {
      const res = await fetch('/api/scraper/progress');
      const data = await res.json();
      setProgress(data);

      if (data.completed >= data.total) {
        clearInterval(interval);
        setIsRunning(false);
      }
    }, 2000);
  };

  return (
    <button onClick={handleClick} disabled={isRunning}>
      {isRunning
        ? `수집 중... (${progress.completed}/${progress.total})`
        : '🔄 지금 수집하기'
      }
    </button>
  );
}
```

### 8.5 실행 모드 요약

| 실행 방법 | 사용 시나리오 | 난이도 |
|-----------|---------------|--------|
| **CLI** (`pnpm scraper:run`) | 터미널에서 빠르게 실행 | 쉬움 |
| **대시보드 버튼** | 웹에서 클릭 한 번으로 | 쉬움 |
| **바탕화면 바로가기** | 더블클릭으로 실행 | 매우 쉬움 |
| **스케줄 (자동)** | 정해진 시간에 자동 실행 | 설정 후 자동 |

---

## 9. 프로젝트 구조 (업데이트)

```
apps/
  scraper/                        # 새로운 로컬 스크래퍼
    ├── package.json
    ├── tsconfig.json
    ├── ecosystem.config.js       # PM2 설정
    ├── src/
    │   ├── index.ts              # 메인 엔트리 + 수집 로직
    │   ├── cli.ts                # CLI 명령어 (수동 실행)
    │   ├── server.ts             # HTTP 서버 (대시보드 연동)
    │   ├── cluster.ts            # puppeteer-cluster 설정
    │   ├── scraper.ts            # 가격 추출 (extension 코드 포팅)
    │   ├── scheduler.ts          # node-cron 스케줄러
    │   ├── config.ts             # 설정 (스케줄, 동시성 등)
    │   └── api-client.ts         # 기존 API 호출
    └── scripts/
        ├── run-scraper.bat       # Windows 바로가기용
        └── run-scraper.sh        # Mac/Linux용
```

---

## 10. 대안: 더 간단한 방법들

### 10.1 Playwright 사용 (Puppeteer 대신)
```typescript
// Playwright은 브라우저 자동 설치
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
```

### 10.2 Windows Task Scheduler 활용
node-cron 대신 Windows 기본 작업 스케줄러 사용:
```batch
:: 매일 오전 7시 실행
schtasks /create /tn "PriceWatch" /tr "node C:\path\to\scraper\dist\index.js" /sc daily /st 07:00
```

### 10.3 Docker 컨테이너 (WSL2 사용 시)
```dockerfile
FROM node:18-slim
RUN apt-get update && apt-get install -y chromium
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "dist/index.js"]
```

---

## 11. 리스크 및 완화

| 리스크 | 확률 | 완화 전략 |
|--------|------|-----------|
| 쿠팡 차단 | 중 | 요청 간 2-5초 딜레이, User-Agent 로테이션 |
| PC 꺼짐 | 해당없음 | 특정 시간대만 수집하므로 문제 없음 |
| Chrome 메모리 | 낮음 | headless 모드 + 탭 자동 정리 |
| DOM 변경 | 중 | 다중 셀렉터 + fallback 로직 |

---

## 12. 결론

### 권장 솔루션
**로컬 Puppeteer + PM2 + node-cron** 조합

### 장점 요약
- **완전 무료** ($0/월)
- Extension 설치 불필요
- **수동 + 자동 수집** 모두 지원
- 3배 빠른 수집 속도
- 간단한 설치 (npm install)

### 예상 구현 시간
- 총 **4-6시간**

### 다음 단계
1. `/pdca design price-collection-improvement` - 상세 설계
2. 또는 바로 구현 시작

---

## 13. 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 0.1 | 2026-02-14 | 초안 (클라우드 기반) |
| 0.2 | 2026-02-14 | 로컬 무료 버전으로 전면 수정 |
| 0.3 | 2026-02-14 | 수동 수집 기능 추가 (CLI, 대시보드, 바로가기) |

---

**승인 필요**: 이 계획으로 진행하시겠습니까?
