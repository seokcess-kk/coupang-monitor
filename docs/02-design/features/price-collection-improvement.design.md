# Design: 가격 수집 방식 개선

**Feature**: price-collection-improvement
**Status**: Draft
**Created**: 2026-02-14
**Plan Reference**: [price-collection-improvement.plan.md](../../01-plan/features/price-collection-improvement.plan.md)

---

## 1. 설계 개요

### 1.1 목표
Chrome Extension 기반 가격 수집을 **로컬 Puppeteer 서비스**로 대체하여:
- Extension 설치 없이 가격 수집
- 3배 빠른 수집 속도 (병렬 처리)
- 수동 + 자동 스케줄 실행 지원
- 기존 Extension 코드 최대한 재사용

### 1.2 범위
| 포함 | 제외 |
|------|------|
| Puppeteer 기반 스크래퍼 | 클라우드 배포 |
| CLI 수동 실행 | 다중 사이트 지원 |
| 스케줄 자동 실행 | 프록시 로테이션 |
| 대시보드 연동 API | Extension 제거 |

---

## 2. 아키텍처 설계

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                         로컬 PC                                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  apps/scraper                               │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │                    Puppeteer Cluster                  │  │ │
│  │  │   ┌────────┐  ┌────────┐  ┌────────┐                │  │ │
│  │  │   │Page #1 │  │Page #2 │  │Page #3 │                │  │ │
│  │  │   └───┬────┘  └───┬────┘  └───┬────┘                │  │ │
│  │  │       │           │           │                      │  │ │
│  │  │       └───────────┼───────────┘                      │  │ │
│  │  │                   ▼                                   │  │ │
│  │  │           ┌───────────────┐                          │  │ │
│  │  │           │ Scraper Core  │ ← Extension 코드 재사용   │  │ │
│  │  │           └───────┬───────┘                          │  │ │
│  │  └───────────────────┼──────────────────────────────────┘  │ │
│  │                      │                                      │ │
│  │  ┌───────────────────┼──────────────────────────────────┐  │ │
│  │  │                   ▼                                   │  │ │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐              │  │ │
│  │  │  │   CLI   │  │ HTTP    │  │ node-   │              │  │ │
│  │  │  │ (수동)  │  │ Server  │  │ cron    │              │  │ │
│  │  │  └────┬────┘  └────┬────┘  └────┬────┘              │  │ │
│  │  │       │            │            │                    │  │ │
│  │  │       └────────────┼────────────┘                    │  │ │
│  │  │                    │                                  │  │ │
│  │  │            Entry Points                               │  │ │
│  │  └────────────────────┼──────────────────────────────────┘  │ │
│  └───────────────────────┼──────────────────────────────────────┘ │
│                          │ HTTP                                   │
│                          ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   apps/web (기존)                           │  │
│  │   POST /api/scraper/trigger  ← 새 API                      │  │
│  │   POST /api/snapshots/batch  ← 기존 API 재사용              │  │
│  │   GET /api/items             ← 기존 API                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          │                                        │
│                          ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   PostgreSQL (기존)                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 모듈 구조

```
apps/scraper/
├── package.json
├── tsconfig.json
├── ecosystem.config.js          # PM2 설정
│
├── src/
│   ├── index.ts                 # 메인 엔트리 (exports)
│   │
│   ├── core/                    # Extension 코드 재사용
│   │   ├── price-parser.ts      # parseKrwPrice, extractPrice
│   │   ├── option-manager.ts    # 옵션 조합, 라운드로빈
│   │   ├── name-extractor.ts    # 제품명 추출
│   │   └── types.ts             # 공유 타입
│   │
│   ├── scraper/                 # Puppeteer 스크래퍼
│   │   ├── cluster.ts           # puppeteer-cluster 설정
│   │   ├── page-scraper.ts      # 단일 페이지 스크래핑
│   │   └── job-processor.ts     # Job 처리 로직
│   │
│   ├── adapters/                # 사이트별 설정 (확장용)
│   │   ├── adapter.interface.ts # CSS 선택자 인터페이스
│   │   └── coupang.adapter.ts   # 쿠팡 CSS 선택자
│   │
│   ├── entry/                   # 실행 진입점
│   │   ├── cli.ts               # CLI 수동 실행
│   │   ├── server.ts            # HTTP 서버 (대시보드 연동)
│   │   └── scheduler.ts         # node-cron 스케줄러
│   │
│   ├── api/                     # 기존 API 클라이언트
│   │   └── client.ts            # /api/jobs/next, /api/snapshots/batch
│   │
│   └── config.ts                # 환경변수, 설정
│
├── scripts/
│   ├── run-scraper.bat          # Windows 바로가기
│   └── run-scraper.sh           # Mac/Linux
│
└── __tests__/
    ├── core/                    # 코어 모듈 테스트
    └── scraper/                 # 스크래퍼 테스트
```

---

## 3. 상세 설계

### 3.1 Core 모듈 (Extension 코드 재사용)

#### 3.1.1 types.ts
```typescript
// 기존 Extension 타입 재사용
export interface ScrapeResult {
  option_key: string;
  price: number | null;
  status_code: 'OK' | 'SOLD_OUT' | 'FAIL_SELECTOR' | 'TIMEOUT';
  raw_price_text?: string;
}

export interface OptionGroup {
  name: string;
  options: string[];
}

export interface ScrapingOptions {
  variantCursor: number;
  variantsPerRun: number;
  pageTimeoutMs: number;
}

export interface ScrapingResult {
  results: ScrapeResult[];
  nextCursor: number;
  pageStatusCode: string;
  productName?: string;
}
```

#### 3.1.2 price-parser.ts
```typescript
// Extension price-extractor.ts에서 포팅
export function parseKrwPrice(text: string): number | null {
  const cleaned = text.replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) || num === 0 ? null : num;
}

export function isValidPrice(text: string): boolean {
  // 단위가격, 백분율, 쿠폰 제외
  if (text.includes('%')) return false;
  if (/\d+[gml]당/i.test(text)) return false;
  if (text.includes('쿠폰')) return false;
  return true;
}

export function extractPriceFromText(html: string): {
  price: number | null;
  statusCode: string;
  rawText?: string;
} {
  // 품절 체크
  if (html.includes('품절') || html.includes('일시품절')) {
    return { price: null, statusCode: 'SOLD_OUT' };
  }

  // "쿠팡판매가" 라벨 우선
  const coupangIdx = html.indexOf('쿠팡판매가');
  if (coupangIdx !== -1) {
    const priceMatch = html.slice(coupangIdx, coupangIdx + 100)
      .match(/[\d,]+원/);
    if (priceMatch) {
      const price = parseKrwPrice(priceMatch[0]);
      if (price) return { price, statusCode: 'OK', rawText: priceMatch[0] };
    }
  }

  // <strong> 태그 가격 추출
  const strongPrices = [...html.matchAll(/<strong[^>]*>([^<]*[\d,]+원[^<]*)<\/strong>/gi)]
    .map(m => m[1])
    .filter(isValidPrice)
    .map(t => parseKrwPrice(t))
    .filter((p): p is number => p !== null);

  if (strongPrices.length > 0) {
    return { price: strongPrices[strongPrices.length - 1], statusCode: 'OK' };
  }

  return { price: null, statusCode: 'FAIL_SELECTOR' };
}
```

#### 3.1.3 option-manager.ts
```typescript
// Extension option-iterator.ts에서 100% 포팅
export function buildOptionKey(labels: string[]): string {
  return labels.length === 0 ? 'default' : labels.join(' / ');
}

export function generateOptionCombinations(groups: OptionGroup[]): string[][] {
  if (groups.length === 0) return [[]];

  return groups.reduce<string[][]>(
    (acc, group) => {
      const newAcc: string[][] = [];
      for (const combo of acc) {
        for (const option of group.options) {
          newAcc.push([...combo, option]);
        }
      }
      return newAcc;
    },
    [[]]
  );
}

export function getVariantsForRun(
  allCombinations: string[][],
  cursor: number,
  perRun: number
): { variants: string[][]; nextCursor: number } {
  const total = allCombinations.length;
  if (total === 0) return { variants: [], nextCursor: 0 };

  const startIdx = cursor % total;
  const endIdx = Math.min(startIdx + perRun, total);
  const variants = allCombinations.slice(startIdx, endIdx);

  // 순환 처리
  if (variants.length < perRun && startIdx > 0) {
    const remaining = perRun - variants.length;
    variants.push(...allCombinations.slice(0, Math.min(remaining, startIdx)));
  }

  const nextCursor = (startIdx + variants.length) % total;
  return { variants, nextCursor };
}
```

### 3.2 Adapter 설계 (사이트별 CSS 선택자)

#### 3.2.1 adapter.interface.ts
```typescript
export interface ScraperAdapter {
  name: string;

  // 가격 추출 선택자 (우선순위순)
  priceSelectors: string[];

  // 옵션 감지 선택자
  optionDetection: {
    containerSelector: string;    // 옵션 영역 컨테이너
    groupTitleSelector: string;   // 옵션 그룹 제목
    itemSelector: string;         // 옵션 아이템
  };

  // 제품명 선택자
  nameSelectors: string[];

  // 품절 판단
  soldOutIndicators: {
    textPatterns: string[];       // 텍스트 패턴 (정규식)
    selectors: string[];          // 품절 표시 요소
  };

  // 페이지 로드 완료 판단
  loadCompleteSelector: string;
}
```

#### 3.2.2 coupang.adapter.ts
```typescript
import { ScraperAdapter } from './adapter.interface';

export const coupangAdapter: ScraperAdapter = {
  name: 'coupang',

  priceSelectors: [
    '.prod-sale-price .total-price strong',
    '.prod-sale-price strong',
    '.total-price strong',
    '[class*="sale-price"] strong',
    '.prod-price strong',
    '[class*="price"] strong',
  ],

  optionDetection: {
    containerSelector: '[class*="option"]',
    groupTitleSelector: '[class*="title"], [class*="label"]',
    itemSelector: 'button, li[role="option"], [class*="option-item"]',
  },

  nameSelectors: [
    '.prod-buy-header h1',
    '.prod-buy-header h2',
    '.prod-buy-header__title',
    'h1.prod-title',
    '[class*="product-title"]',
  ],

  soldOutIndicators: {
    textPatterns: ['품절', '일시품절', 'sold out'],
    selectors: ['.oos-label', '[class*="sold-out"]'],
  },

  loadCompleteSelector: '.prod-buy-header, .prod-sale-price',
};
```

### 3.3 Puppeteer Cluster 설계

#### 3.3.1 cluster.ts
```typescript
import { Cluster } from 'puppeteer-cluster';
import { config } from '../config';

export async function createCluster(): Promise<Cluster> {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: config.concurrency,  // 기본 3
    puppeteerOptions: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      defaultViewport: { width: 1280, height: 800 },
    },
    timeout: config.pageTimeoutMs,
    retryLimit: config.maxRetries,
    retryDelay: 1000,
  });

  // 에러 핸들링
  cluster.on('taskerror', (err, data) => {
    console.error(`Task error for ${data.url}:`, err.message);
  });

  return cluster;
}
```

#### 3.3.2 page-scraper.ts
```typescript
import { Page } from 'puppeteer';
import { ScraperAdapter } from '../adapters/adapter.interface';
import { coupangAdapter } from '../adapters/coupang.adapter';
import { parseKrwPrice, isValidPrice } from '../core/price-parser';
import {
  buildOptionKey,
  generateOptionCombinations,
  getVariantsForRun,
  OptionGroup,
} from '../core/option-manager';
import { ScrapeResult, ScrapingOptions, ScrapingResult } from '../core/types';
import { config } from '../config';

export class PageScraper {
  constructor(private adapter: ScraperAdapter = coupangAdapter) {}

  async scrape(
    page: Page,
    url: string,
    options: ScrapingOptions
  ): Promise<ScrapingResult> {
    // 1. 페이지 로드
    await page.goto(url, { waitUntil: 'networkidle2' });
    await this.waitForContent(page);

    // 2. 제품명 추출
    const productName = await this.extractProductName(page);

    // 3. 품절 체크
    const isSoldOut = await this.checkSoldOut(page);
    if (isSoldOut) {
      return {
        results: [{ option_key: 'default', price: null, status_code: 'SOLD_OUT' }],
        nextCursor: 0,
        pageStatusCode: 'SOLD_OUT',
        productName,
      };
    }

    // 4. 옵션 그룹 감지
    const optionGroups = await this.detectOptionGroups(page);

    // 5. 옵션 없는 경우: 단일 가격 추출
    if (optionGroups.length === 0) {
      const priceResult = await this.extractPrice(page);
      return {
        results: [{
          option_key: 'default',
          price: priceResult.price,
          status_code: priceResult.statusCode,
          raw_price_text: priceResult.rawText,
        }],
        nextCursor: 0,
        pageStatusCode: priceResult.statusCode,
        productName,
      };
    }

    // 6. 옵션 있는 경우: 라운드로빈 순회
    const allCombinations = generateOptionCombinations(optionGroups);
    const { variants, nextCursor } = getVariantsForRun(
      allCombinations,
      options.variantCursor,
      options.variantsPerRun
    );

    const results: ScrapeResult[] = [];
    for (const labels of variants) {
      await this.selectOptions(page, labels, optionGroups);
      await this.randomDelay();

      const priceResult = await this.extractPrice(page);
      results.push({
        option_key: buildOptionKey(labels),
        price: priceResult.price,
        status_code: priceResult.statusCode,
        raw_price_text: priceResult.rawText,
      });
    }

    const pageStatusCode = results.every(r => r.status_code === 'OK')
      ? 'OK'
      : results.some(r => r.status_code === 'OK')
        ? 'PARTIAL'
        : 'FAIL_SELECTOR';

    return { results, nextCursor, pageStatusCode, productName };
  }

  private async waitForContent(page: Page): Promise<void> {
    try {
      await page.waitForSelector(this.adapter.loadCompleteSelector, {
        timeout: 5000,
      });
    } catch {
      // 타임아웃 시 계속 진행
    }
    await page.waitForTimeout(1000);  // 추가 대기
  }

  private async extractProductName(page: Page): Promise<string | null> {
    for (const selector of this.adapter.nameSelectors) {
      const name = await page.$eval(selector, el => el.textContent?.trim())
        .catch(() => null);
      if (name) return name;
    }
    return null;
  }

  private async checkSoldOut(page: Page): Promise<boolean> {
    // 텍스트 패턴 체크
    const bodyText = await page.$eval('body', el => el.innerText);
    for (const pattern of this.adapter.soldOutIndicators.textPatterns) {
      if (bodyText.toLowerCase().includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // 선택자 체크
    for (const selector of this.adapter.soldOutIndicators.selectors) {
      const exists = await page.$(selector);
      if (exists) return true;
    }

    return false;
  }

  private async detectOptionGroups(page: Page): Promise<OptionGroup[]> {
    return page.evaluate((adapter) => {
      const groups: { name: string; options: string[] }[] = [];
      const containers = document.querySelectorAll(adapter.optionDetection.containerSelector);

      containers.forEach(container => {
        const title = container.querySelector(adapter.optionDetection.groupTitleSelector);
        const items = container.querySelectorAll(adapter.optionDetection.itemSelector);

        if (items.length > 0) {
          const options = Array.from(items)
            .map(item => item.textContent?.trim())
            .filter((t): t is string => !!t && !t.includes('원'));

          if (options.length > 0) {
            groups.push({
              name: title?.textContent?.trim() || `옵션${groups.length + 1}`,
              options,
            });
          }
        }
      });

      return groups;
    }, this.adapter);
  }

  private async extractPrice(page: Page): Promise<{
    price: number | null;
    statusCode: string;
    rawText?: string;
  }> {
    for (const selector of this.adapter.priceSelectors) {
      const result = await page.$eval(selector, el => {
        const text = el.textContent?.trim() || '';
        return text;
      }).catch(() => null);

      if (result && isValidPrice(result)) {
        const price = parseKrwPrice(result);
        if (price) {
          return { price, statusCode: 'OK', rawText: result };
        }
      }
    }

    return { price: null, statusCode: 'FAIL_SELECTOR' };
  }

  private async selectOptions(
    page: Page,
    labels: string[],
    groups: OptionGroup[]
  ): Promise<void> {
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const selector = this.adapter.optionDetection.itemSelector;

      await page.evaluate((selector, label) => {
        const items = document.querySelectorAll(selector);
        for (const item of items) {
          if (item.textContent?.trim() === label) {
            (item as HTMLElement).click();
            break;
          }
        }
      }, selector, label);

      await page.waitForTimeout(300);  // 옵션 변경 대기
    }
  }

  private async randomDelay(): Promise<void> {
    const delay = Math.random() * (config.maxDelay - config.minDelay) + config.minDelay;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

### 3.4 Entry Points 설계

#### 3.4.1 CLI (cli.ts)
```typescript
import { Command } from 'commander';
import { runScrapeJob, ScraperService } from '../index';

const program = new Command();

program
  .name('pricewatch-scraper')
  .description('쿠팡 가격 수집 CLI')
  .version('1.0.0');

program
  .command('run')
  .description('가격 수집 실행')
  .option('-a, --all', '전체 상품 수집', false)
  .option('-i, --items <ids>', '특정 상품 ID (쉼표 구분)')
  .option('-g, --group <name>', '특정 그룹만 수집')
  .option('-c, --concurrency <n>', '동시 브라우저 수', '3')
  .action(async (options) => {
    console.log('🚀 가격 수집 시작...\n');

    const scraper = new ScraperService({
      concurrency: parseInt(options.concurrency),
    });

    try {
      const itemIds = options.items?.split(',').map((s: string) => s.trim());

      const result = await scraper.run({
        mode: options.all ? 'all' : 'selected',
        itemIds,
        group: options.group,
      });

      console.log('\n✅ 수집 완료!');
      console.log(`   성공: ${result.success}개`);
      console.log(`   실패: ${result.failed}개`);
      console.log(`   소요시간: ${result.durationMs}ms`);
    } catch (error) {
      console.error('❌ 수집 실패:', error);
      process.exit(1);
    }

    process.exit(0);
  });

program
  .command('status')
  .description('스크래퍼 상태 확인')
  .action(async () => {
    const status = await getScraperStatus();
    console.table(status);
  });

program.parse();
```

#### 3.4.2 HTTP Server (server.ts)
```typescript
import express from 'express';
import { ScraperService } from '../index';
import { config } from '../config';

const app = express();
app.use(express.json());

let currentJob: {
  id: string;
  total: number;
  completed: number;
  failed: number;
  startedAt: Date;
} | null = null;

const scraper = new ScraperService();

// 수집 시작
app.post('/run', async (req, res) => {
  if (currentJob) {
    return res.status(409).json({
      error: 'Job already running',
      jobId: currentJob.id,
    });
  }

  const { itemIds, mode = 'all' } = req.body;
  const jobId = `job_${Date.now()}`;

  currentJob = {
    id: jobId,
    total: 0,
    completed: 0,
    failed: 0,
    startedAt: new Date(),
  };

  res.json({ status: 'started', jobId });

  // 비동기 실행
  scraper.run({
    mode,
    itemIds,
    onProgress: (completed, failed, total) => {
      if (currentJob) {
        currentJob.completed = completed;
        currentJob.failed = failed;
        currentJob.total = total;
      }
    },
  })
    .then(() => {
      console.log(`Job ${jobId} completed`);
    })
    .catch(err => {
      console.error(`Job ${jobId} failed:`, err);
    })
    .finally(() => {
      currentJob = null;
    });
});

// 진행 상황 조회
app.get('/progress', (req, res) => {
  if (!currentJob) {
    return res.json({ running: false });
  }

  res.json({
    running: true,
    jobId: currentJob.id,
    total: currentJob.total,
    completed: currentJob.completed,
    failed: currentJob.failed,
    elapsed: Date.now() - currentJob.startedAt.getTime(),
  });
});

// 상태 조회
app.get('/status', async (req, res) => {
  res.json({
    running: !!currentJob,
    lastRun: await getLastRunInfo(),
    config: {
      concurrency: config.concurrency,
      schedules: config.schedules,
    },
  });
});

// 수집 중지
app.post('/stop', async (req, res) => {
  if (currentJob) {
    await scraper.stop();
    currentJob = null;
    res.json({ status: 'stopped' });
  } else {
    res.json({ status: 'not_running' });
  }
});

const PORT = config.serverPort || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Scraper API running on http://localhost:${PORT}`);
});
```

#### 3.4.3 Scheduler (scheduler.ts)
```typescript
import cron from 'node-cron';
import { ScraperService } from '../index';
import { config } from '../config';

const scraper = new ScraperService();

export function startScheduler(): void {
  console.log('📅 스케줄러 시작');

  for (const schedule of config.schedules) {
    cron.schedule(schedule.cron, async () => {
      console.log(`\n⏰ 스케줄 실행: ${schedule.name} (${schedule.cron})`);

      try {
        const result = await scraper.run({
          mode: schedule.mode || 'all',
          itemIds: schedule.itemIds,
        });

        console.log(`✅ 완료: ${result.success}/${result.total}`);
      } catch (error) {
        console.error(`❌ 실패:`, error);
      }
    });

    console.log(`   등록: ${schedule.name} - ${schedule.cron}`);
  }
}

// 메인 실행
if (require.main === module) {
  startScheduler();
}
```

### 3.5 API Client (기존 API 재사용)

#### 3.5.1 client.ts
```typescript
import { config } from '../config';
import { ScrapeResult } from '../core/types';

interface JobResponse {
  jobId: string;
  itemId: string;
  url: string;
  name: string | null;
  variantCursor: number;
  variantsPerRun: number;
  pageTimeoutMs: number;
}

interface ItemInfo {
  id: string;
  url: string;
  name: string | null;
  variantCursor: number;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.apiKey = config.apiKey;
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey,
    };
  }

  // 전체 아이템 목록 조회 (Job enqueue 없이 직접 처리)
  async getItems(): Promise<ItemInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/items`, {
      headers: this.headers,
    });

    if (!res.ok) throw new Error(`Failed to get items: ${res.status}`);

    const data = await res.json();
    return data.map((item: any) => ({
      id: item.id,
      url: item.url,
      name: item.name,
      variantCursor: item.variantCursor || 0,
    }));
  }

  // 스냅샷 업로드 (기존 API 재사용)
  async uploadSnapshots(
    itemId: string,
    url: string,
    results: ScrapeResult[],
    nextCursor: number,
    pageStatusCode: string,
    productName?: string
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/snapshots/batch`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        item_id: itemId,
        url,
        results: results.map(r => ({
          option_key: r.option_key,
          price: r.price,
          status_code: r.status_code,
          raw_price_text: r.raw_price_text,
        })),
        page_status_code: pageStatusCode,
        checked_at: new Date().toISOString(),
        variant_cursor: nextCursor,
        product_name: productName,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to upload snapshots: ${res.status}`);
    }
  }
}
```

### 3.6 Configuration

#### 3.6.1 config.ts
```typescript
import dotenv from 'dotenv';
dotenv.config();

export interface ScheduleConfig {
  name: string;
  cron: string;
  mode?: 'all' | 'selected';
  itemIds?: string[];
}

export const config = {
  // API 연동
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.EXTENSION_API_KEY || '',

  // Puppeteer 설정
  concurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '3'),
  headless: process.env.SCRAPER_HEADLESS !== 'false',
  pageTimeoutMs: parseInt(process.env.PAGE_TIMEOUT_MS || '20000'),
  variantsPerRun: parseInt(process.env.DEFAULT_VARIANT_PER_RUN || '15'),

  // 딜레이 설정
  minDelay: parseInt(process.env.SCRAPER_MIN_DELAY || '2000'),
  maxDelay: parseInt(process.env.SCRAPER_MAX_DELAY || '5000'),

  // 재시도 설정
  maxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES || '2'),

  // 서버 설정
  serverPort: parseInt(process.env.SCRAPER_PORT || '3001'),

  // 스케줄 설정
  schedules: JSON.parse(process.env.SCRAPER_SCHEDULES || JSON.stringify([
    { name: '오전 수집', cron: '0 7 * * *' },
    { name: '저녁 수집', cron: '0 19 * * *' },
  ])) as ScheduleConfig[],
};
```

---

## 4. 대시보드 연동 (기존 apps/web 수정)

### 4.1 새 API 엔드포인트

#### /api/scraper/trigger (새로 추가)
```typescript
// apps/web/app/api/scraper/trigger/route.ts
import { NextResponse } from 'next/server';

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:3001';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${SCRAPER_URL}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to trigger scraper' },
      { status: 500 }
    );
  }
}
```

#### /api/scraper/progress (새로 추가)
```typescript
// apps/web/app/api/scraper/progress/route.ts
import { NextResponse } from 'next/server';

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const res = await fetch(`${SCRAPER_URL}/progress`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ running: false, error: 'Scraper not available' });
  }
}
```

### 4.2 RefreshButton 컴포넌트 수정

```typescript
// apps/web/components/RefreshButton.tsx (수정)
'use client';

import { useState, useEffect } from 'react';

interface Props {
  itemIds?: string[];
}

export function RefreshButton({ itemIds }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, failed: 0 });

  // 진행 상황 폴링
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(async () => {
      const res = await fetch('/api/scraper/progress');
      const data = await res.json();

      if (!data.running) {
        setIsRunning(false);
        clearInterval(interval);
        // 완료 후 목록 새로고침
        window.location.reload();
      } else {
        setProgress({
          completed: data.completed,
          total: data.total,
          failed: data.failed,
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const handleClick = async () => {
    setIsRunning(true);

    try {
      await fetch('/api/scraper/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: itemIds ? 'selected' : 'all',
          itemIds,
        }),
      });
    } catch (error) {
      console.error('Failed to start scraper:', error);
      setIsRunning(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isRunning}
      className={`px-4 py-2 rounded ${
        isRunning
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
      }`}
    >
      {isRunning ? (
        <span>
          수집 중... ({progress.completed}/{progress.total})
          {progress.failed > 0 && ` (실패: ${progress.failed})`}
        </span>
      ) : (
        '🔄 지금 수집하기'
      )}
    </button>
  );
}
```

---

## 5. 환경변수

### 5.1 apps/scraper/.env
```bash
# API 연동 (기존 환경변수 재사용)
API_BASE_URL=http://localhost:3000
EXTENSION_API_KEY=your-api-key

# Puppeteer 설정
SCRAPER_CONCURRENCY=3
SCRAPER_HEADLESS=true
PAGE_TIMEOUT_MS=20000
DEFAULT_VARIANT_PER_RUN=15

# 딜레이 설정 (차단 회피)
SCRAPER_MIN_DELAY=2000
SCRAPER_MAX_DELAY=5000
SCRAPER_MAX_RETRIES=2

# HTTP 서버
SCRAPER_PORT=3001

# 스케줄 (JSON 배열)
SCRAPER_SCHEDULES='[{"name":"오전","cron":"0 7 * * *"},{"name":"저녁","cron":"0 19 * * *"}]'
```

### 5.2 apps/web/.env (추가)
```bash
# 기존 환경변수 유지
# ...

# 스크래퍼 연동 (추가)
SCRAPER_URL=http://localhost:3001
```

---

## 6. 구현 순서

### Phase 1: Core 모듈 (2시간)
1. [ ] `apps/scraper` 패키지 초기화
2. [ ] `core/types.ts` - 타입 정의
3. [ ] `core/price-parser.ts` - Extension 코드 포팅
4. [ ] `core/option-manager.ts` - Extension 코드 포팅
5. [ ] `core/name-extractor.ts` - Extension 코드 포팅
6. [ ] Core 모듈 테스트

### Phase 2: Puppeteer Scraper (3시간)
1. [ ] `adapters/adapter.interface.ts`
2. [ ] `adapters/coupang.adapter.ts`
3. [ ] `scraper/cluster.ts`
4. [ ] `scraper/page-scraper.ts`
5. [ ] `scraper/job-processor.ts`
6. [ ] `api/client.ts`
7. [ ] 통합 테스트

### Phase 3: Entry Points (2시간)
1. [ ] `entry/cli.ts` - CLI 구현
2. [ ] `entry/server.ts` - HTTP 서버
3. [ ] `entry/scheduler.ts` - 스케줄러
4. [ ] `config.ts` - 설정 관리
5. [ ] `index.ts` - 메인 exports

### Phase 4: 대시보드 연동 (1시간)
1. [ ] `apps/web/app/api/scraper/trigger/route.ts`
2. [ ] `apps/web/app/api/scraper/progress/route.ts`
3. [ ] `RefreshButton.tsx` 수정
4. [ ] 통합 테스트

### Phase 5: PM2 설정 및 스크립트 (30분)
1. [ ] `ecosystem.config.js`
2. [ ] `scripts/run-scraper.bat`
3. [ ] `scripts/run-scraper.sh`
4. [ ] package.json 스크립트 추가

---

## 7. 테스트 계획

### 7.1 단위 테스트
| 모듈 | 테스트 항목 | 우선순위 |
|------|------------|----------|
| price-parser | parseKrwPrice, isValidPrice | HIGH |
| option-manager | generateOptionCombinations, getVariantsForRun | HIGH |
| page-scraper | extractPrice, detectOptionGroups | MEDIUM |

### 7.2 통합 테스트
| 시나리오 | 테스트 내용 |
|----------|------------|
| 단일 상품 수집 | 옵션 없는 상품 가격 추출 |
| 옵션 상품 수집 | 옵션 순회 + 가격 추출 |
| 라운드로빈 | cursor 기반 분할 수집 |
| API 연동 | snapshots/batch 업로드 |

### 7.3 E2E 테스트
| 시나리오 | 검증 항목 |
|----------|----------|
| CLI 전체 수집 | `pnpm scraper:run --all` → DB 업데이트 |
| 대시보드 버튼 | 버튼 클릭 → 진행률 표시 → 완료 |
| 스케줄 실행 | cron 트리거 → 자동 수집 |

---

## 8. 의존성

### 8.1 apps/scraper/package.json
```json
{
  "name": "@pricewatch/scraper",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/entry/server.ts",
    "build": "tsc",
    "start": "node dist/entry/server.js",
    "cli": "tsx src/entry/cli.ts",
    "scraper:run": "tsx src/entry/cli.ts run",
    "scheduler": "tsx src/entry/scheduler.ts"
  },
  "dependencies": {
    "puppeteer": "^22.0.0",
    "puppeteer-cluster": "^0.24.0",
    "express": "^4.18.0",
    "node-cron": "^3.0.0",
    "commander": "^12.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/node-cron": "^3.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 9. 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-02-14 | 초안 작성 |

---

**다음 단계**: `/pdca do` 실행하여 구현 시작
