# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PriceWatch is a Coupang (Korean e-commerce) product price monitoring SaaS (MVP). It tracks option-level displayed base prices for up to 100 product URLs, maintains 7-day/30-day price lows, and sends Slack alerts on new lows. Price data is collected exclusively via a Chrome Extension (MV3) that reads the DOM — no server-side scraping.

## Requirements

- Node.js >= 18
- pnpm 9.15.4 (`packageManager` field enforced)
- PostgreSQL 17 (via Docker or Supabase)

## Commands

```bash
pnpm i                      # Install dependencies
pnpm dev                    # Run dev server (Next.js on localhost:3000)
pnpm build                  # Build web app
pnpm lint                   # Lint all packages (next lint for web, tsc --noEmit for extension/db)

# Database
docker compose up -d        # Start local PostgreSQL (port 5433 → 5432)
pnpm db:migrate             # Run Prisma migrations (prisma migrate dev)
pnpm db:studio              # Open Prisma Studio
pnpm --filter @pricewatch/db generate  # Regenerate Prisma client after schema changes

# Testing (Vitest workspace mode)
pnpm test                   # Run all tests across all packages
pnpm test:watch             # Watch mode
pnpm test:coverage          # Coverage report (v8 provider)
pnpm test -- apps/web/__tests__/unit/csv-parser.test.ts  # Single test file

# Extension
pnpm --filter @pricewatch/extension build  # esbuild → apps/extension/dist/
```

### Prisma Workflow

When modifying `packages/db/prisma/schema.prisma`:
1. Edit the schema
2. `pnpm db:migrate` — creates migration SQL and applies it
3. Prisma client is auto-regenerated after migration

For schema-only push without migration files: `pnpm --filter @pricewatch/db db:push`

## Tech Stack

- **Web/API**: Next.js (App Router) + TypeScript
- **DB**: PostgreSQL (Supabase) + Prisma ORM
- **Deploy**: Vercel
- **Alerts**: Slack Incoming Webhooks
- **Agent**: Chrome Extension MV3 (DOM scraping)
- **Package Manager**: pnpm (monorepo)

## Architecture

### Monorepo Layout

- `apps/web/` — Next.js 15 App Router web app and REST API (dashboard, CSV import, job management). Path alias: `@/` → `apps/web/`
- `apps/extension/` — Chrome Extension MV3 browser agent (esbuild, outputs to `dist/`). Polls for jobs, opens product pages, extracts prices from DOM, uploads snapshots
- `packages/db/` — Shared Prisma schema, client singleton, and URL normalization. Consumed by web as `@pricewatch/db` workspace dependency

### Shared Types

- `apps/web/lib/types.ts` — Dashboard/API response types (`ItemRow`, `VariantRow`, `SnapshotRow`, `ItemData`)
- `apps/extension/src/types.ts` — Extension-server communication types (`ScrapeResult`, `JobResponse`, `ScrapingResponse`)

### Web Utilities (apps/web/lib/)

- `auth.ts` — API key validation for extension authentication
- `csv-parser.ts` — CSV file parsing and validation
- `price-calculation.ts` — 7D/30D low price computation logic
- `price-event.ts` — PriceEvent creation and detection
- `slack-alert.ts` — Slack webhook notification
- `format.ts` — Price/date formatting helpers

### Domain Models (packages/db/schema.prisma)

- **Item** — A tracked product URL (deduplicated by normalized URL)
- **Variant** — An option combination within an Item (unique by `itemId + optionKey`)
- **Snapshot** — A price observation for a variant at a point in time
- **PriceEvent** — Fired when a new 7D or 30D price low is detected
- **Job** — Refresh queue entry with status lifecycle (see Job State Machine below)

### Job State Machine

Jobs follow a state lifecycle with automatic stale recovery:

```
PENDING → IN_PROGRESS → DONE
                     ↘ FAILED
```

- `PENDING`: Waiting to be picked up by extension
- `IN_PROGRESS`: Extension is processing (set by `/api/jobs/next`)
- `DONE`: Successfully completed
- `FAILED`: Scraping failed

**Stale Job Recovery**: Jobs stuck in `IN_PROGRESS` for >10 minutes are automatically reset to `PENDING` by the `/api/jobs/next` endpoint. This prevents crawl failures when extension crashes or disconnects.

### Data Flow

1. User uploads CSV or adds items → URLs normalized and deduplicated by `{productId}:{itemId}:{vendorItemId}`
2. Manual or scheduled refresh enqueues Jobs
3. Chrome Extension polls `GET /api/jobs/next` (auth via `X-API-KEY`, single concurrency)
4. Extension opens page, extracts displayed base price and option variants from DOM
5. Extension POSTs batch results to `POST /api/snapshots/batch`
6. Server computes lows; if new 7D/30D low → creates PriceEvent → fires Slack webhook

### API Endpoints

See `API_SPEC.md` for full specification. Key endpoints:

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/items` | GET | — | List items with computed stats |
| `/api/items/[id]` | GET | — | Item detail + variants + snapshots |
| `/api/items/upload-csv` | POST | — | CSV import |
| `/api/jobs/enqueue` | POST | — | Queue refresh jobs |
| `/api/jobs/next` | GET | `X-API-KEY` | Extension polls for next job (+ stale recovery) |
| `/api/jobs/status` | GET | — | Job queue statistics (pending/done/failed counts) |
| `/api/snapshots/batch` | POST | `X-API-KEY` | Extension submits scraped data |

### Extension Structure

- `src/background/service-worker.ts` — Job polling, tab management, API communication
- `src/content/content-script.ts` — Main orchestrator injected into product pages
- `src/content/price-extractor.ts` — DOM price extraction logic
- `src/content/option-iterator.ts` — Option variant iteration and cursor management
- `src/content/name-extractor.ts` — Product name extraction
- `src/popup/popup.ts` — Extension popup UI

### Price Extraction Rules (SCRAPER_RULES.md)

The extension uses a priority-based strategy:
1. If DOM label "쿠팡판매가" exists → use the price associated with that label
2. Otherwise → use the final displayed price in the main price block, excluding percentages, unit prices ("100g당"), and coupon amounts
3. Options are iterated via round-robin cursor (`variantCursor`), default 15 variants per run, with 300-800ms debounce between option clicks

### Coupang DOM Selectors (2026-02 기준, 정상 작동 확인)

**중요**: 쿠팡 페이지 HTML 구조가 변경되면 아래 선택자와 관련 파일을 업데이트해야 함.

**상품명 추출** (`name-extractor.ts`):
```
우선순위:
1. h1.product-title span.twc-font-bold  ← 현재 작동
2. h1.product-title
3. .prod-buy-header h1 (레거시)
```
- HTML 구조: `<h1 class="product-title ..."><span class="twc-font-bold">상품명</span></h1>`

**가격 추출** (`price-extractor.ts`):
```
우선순위:
1. .price-container .final-price-amount  ← 현재 작동 (최종가)
2. .price-container .sales-price-amount  (판매가)
3. .final-price-amount
4. .sales-price-amount
5. .prod-sale-price strong (레거시)
```
- HTML 구조: `<div class="price-amount final-price-amount">15,670원</div>`
- 단위가격 제외: `.final-unit-price` (예: "100g당 522원")

**품절 확인**:
- 선택자: `.oos-label`, `.out-of-stock`, `[class*='sold-out']`
- 구매 버튼 텍스트: "품절", "일시품절", "재입고" 포함 여부

**관련 파일**:
- `apps/extension/src/content/price-extractor.ts` — 가격 추출 로직
- `apps/extension/src/content/name-extractor.ts` — 상품명 추출 로직

### URL Normalization (URL_NORMALIZATION.md)

All user-provided URLs are normalized to canonical form before storage:
```
https://www.coupang.com/vp/products/{productId}?itemId={itemId}&vendorItemId={vendorItemId}
```
Tracking params (`q`, `searchId`, `rank`, `traceId`, etc.) are stripped. Dedup key: `{productId}:{itemId}:{vendorItemId}`.

## Testing

- **Framework**: Vitest (workspace mode via `vitest.workspace.ts`, 3 workspaces: `packages/db`, `apps/web`, `apps/extension`)
- **Config**: `globals: true` (no explicit vitest imports needed), `environment: "node"` in all workspaces
- **Test locations**:
  - `apps/web/__tests__/` — API route and unit tests (CSV parsing, price calculation, auth, Slack alerts)
  - `apps/extension/__tests__/` — Price extraction and option parser tests
  - `packages/db/__tests__/` — DB client and URL normalization tests

## Key Constraints

- **No server-side scraping** — all price collection happens in the Chrome Extension via DOM reading
- **Extension concurrency = 1** — only one page open at a time
- **Page timeout = 20s** — extension must complete within `PAGE_TIMEOUT_MS`
- **Display price only** — exclude coupons and personalized benefits; use 표시가 (displayed base price)
- **Max ~100 items** per instance (MVP scope)

## Environment Variables

See `.env.example` for required configuration:
- `DATABASE_URL` — PostgreSQL connection string (local Docker: `postgresql://postgres:postgres@localhost:5433/pricewatch`)
- `SLACK_WEBHOOK_URL` — Slack Incoming Webhook for price alerts (optional, gracefully skipped if unset)
- `EXTENSION_API_KEY` — Shared secret for extension auth (`X-API-KEY` header)
- `DEFAULT_VARIANT_PER_RUN` — Max option variants per scrape run (default: 15)
- `PAGE_TIMEOUT_MS` — Extension page load timeout (default: 20000)

## Reference Documentation

- `AGENTS.md` — Project goals, tech stack, MVP definition of done
- `API_SPEC.md` — Full REST API specification
- `SCRAPER_RULES.md` — Detailed DOM price extraction and option handling rules
- `EXTENSION_NOTES.md` — DOM strategy heuristics for sample pages
- `URL_NORMALIZATION.md` — URL canonical form and dedup logic
