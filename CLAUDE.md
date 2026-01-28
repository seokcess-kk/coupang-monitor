# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PriceWatch is a Coupang (Korean e-commerce) product price monitoring SaaS (MVP). It tracks option-level displayed base prices for up to 100 product URLs, maintains 7-day/30-day price lows, and sends Slack alerts on new lows. Price data is collected exclusively via a Chrome Extension (MV3) that reads the DOM — no server-side scraping.

## Commands

```bash
pnpm i                      # Install dependencies
pnpm dev                    # Run dev server (Next.js)
pnpm build                  # Build web app
pnpm lint                   # Lint all packages
pnpm db:migrate             # Run database migrations
pnpm db:studio              # Open Prisma Studio

# Testing
pnpm test                   # Run all tests (Vitest)
pnpm test:watch             # Watch mode
pnpm test:coverage          # Coverage report

# Run a single test file
pnpm test -- apps/web/__tests__/unit/csv-parser.test.ts

# Build extension
pnpm --filter @pricewatch/extension build
```

## Tech Stack

- **Web/API**: Next.js (App Router) + TypeScript
- **DB**: PostgreSQL (Supabase) + Prisma ORM
- **Deploy**: Vercel
- **Alerts**: Slack Incoming Webhooks
- **Agent**: Chrome Extension MV3 (DOM scraping)
- **Package Manager**: pnpm (monorepo)

## Architecture

### Monorepo Layout

- `apps/web/` — Next.js App Router web app and REST API (dashboard, CSV import, job management)
- `apps/extension/` — Chrome Extension MV3 browser agent that polls for jobs, opens product pages, extracts prices from the DOM, and uploads snapshots
- `packages/db/` — Shared Prisma schema and database client

### Domain Models (packages/db/schema.prisma)

- **Item** — A tracked product URL (deduplicated by normalized URL)
- **Variant** — An option combination within an Item (unique by `itemId + optionKey`)
- **Snapshot** — A price observation for a variant at a point in time
- **PriceEvent** — Fired when a new 7D or 30D price low is detected
- **Job** — Refresh queue entry (PENDING/DONE/FAILED, manual/scheduled)

### Data Flow

1. User uploads CSV or adds items → URLs normalized and deduplicated by `{productId}:{itemId}:{vendorItemId}`
2. Manual or scheduled refresh enqueues Jobs
3. Chrome Extension polls `GET /api/jobs/next` (auth via `X-API-KEY`, single concurrency)
4. Extension opens page, extracts displayed base price and option variants from DOM
5. Extension POSTs batch results to `POST /api/snapshots/batch`
6. Server computes lows; if new 7D/30D low → creates PriceEvent → fires Slack webhook

### API Endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/items/upload-csv` | POST | — | CSV import with URL normalization and dedup |
| `/api/items` | GET | — | List items with computed stats (current_low, low_7d, low_30d, status) |
| `/api/items/:id` | GET | — | Item detail + variants + 30-day snapshots |
| `/api/jobs/enqueue` | POST | — | Queue refresh jobs (all/selected, manual/scheduled) |
| `/api/jobs/next` | GET | `X-API-KEY` | Extension polls for next pending job |
| `/api/snapshots/batch` | POST | `X-API-KEY` | Extension submits scraped price data |

### Price Extraction Rules (SCRAPER_RULES.md)

The extension uses a priority-based strategy:
1. If DOM label "쿠팡판매가" exists → use the price associated with that label
2. Otherwise → use the final displayed price in the main price block, excluding percentages, unit prices ("100g당"), and coupon amounts
3. Options are iterated via round-robin cursor (`variantCursor`), default 15 variants per run, with 300-800ms debounce between option clicks

### URL Normalization (URL_NORMALIZATION.md)

All user-provided URLs are normalized to canonical form before storage:
```
https://www.coupang.com/vp/products/{productId}?itemId={itemId}&vendorItemId={vendorItemId}
```
Tracking params (`q`, `searchId`, `rank`, `traceId`, etc.) are stripped. Dedup key: `{productId}:{itemId}:{vendorItemId}`.

## Testing

- **Framework**: Vitest (workspace mode via `vitest.workspace.ts`)
- **Test locations**:
  - `apps/web/__tests__/` — API route and unit tests (CSV parsing, price calculation, auth, Slack alerts)
  - `apps/extension/__tests__/` — Price extraction and option parser tests
  - `packages/db/__tests__/` — DB client and URL normalization tests
- **Run all**: `pnpm test`
- **Run single file**: `pnpm test -- apps/web/__tests__/unit/csv-parser.test.ts`
- **Watch mode**: `pnpm test:watch`

## Key Constraints

- **No server-side scraping** — all price collection happens in the Chrome Extension via DOM reading
- **Extension concurrency = 1** — only one page open at a time
- **Page timeout = 20s** — extension must complete within `PAGE_TIMEOUT_MS`
- **Display price only** — exclude coupons and personalized benefits; use 표시가 (displayed base price)
- **Max ~100 items** per instance (MVP scope)

## Environment Variables

See `.env.example` for required configuration: `DATABASE_URL`, `SLACK_WEBHOOK_URL`, `EXTENSION_API_KEY`, `DEFAULT_VARIANT_PER_RUN`, `PAGE_TIMEOUT_MS`.

## Reference Documentation

- `AGENTS.md` — Project goals, tech stack, MVP definition of done
- `API_SPEC.md` — Full REST API specification
- `SCRAPER_RULES.md` — Detailed DOM price extraction and option handling rules
- `EXTENSION_NOTES.md` — DOM strategy heuristics for sample pages
- `URL_NORMALIZATION.md` — URL canonical form and dedup logic
