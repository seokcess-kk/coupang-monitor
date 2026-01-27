# AGENTS.md — PriceWatch

## Goal
- Monitor Coupang product detail URLs (<=100).
- Collect displayed base price (exclude coupons/personalized benefits).
- Track option-level lowest price, 7D/30D lows, price trend.
- Alert via Slack when a new 7D or 30D low occurs.
- Support manual refresh and scheduled refresh (5/10/30/60 min).

## Non-negotiables
- NO server-side scraping.
- All scraping via Chrome Extension (MV3) reading DOM.
- Options may be many. MVP collects up to N variants per run (default 15) using round-robin.
- Extension concurrency=1, page timeout=20s.

## Stack
- Web/API: Next.js (App Router) + TypeScript
- DB: Postgres (Supabase) + Prisma
- Deploy: Vercel
- Alert: Slack Incoming Webhook
- Agent: Chrome Extension MV3

## Domains
- Item (product URL)
- Variant (option_key)
- Snapshot (variant observation)
- PriceEvent (new low)
- Job (refresh queue)

## Commands
- Install: pnpm i
- Dev: pnpm dev
- DB migrate: pnpm prisma migrate dev

## Definition of Done (MVP)
- CSV upload works with dedupe/validation
- Dashboard shows current low, 7D/30D lows, status
- Item detail shows trend + variants table
- Manual refresh (all/selected)
- Scheduled refresh with distributed queue
- Extension pulls jobs, scrapes DOM, uploads snapshots
- Slack alert fires on new 7D/30D low
