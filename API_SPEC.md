# API SPEC (MVP)

## Items
POST /api/items/upload-csv
- CSV columns: name,url,group,memo
- Deduplicate by normalized URL

GET /api/items
- Returns items with computed:
  current_low, lowest_variant, low_7d, low_30d, last_checked_at, status

GET /api/items/:id
- Item summary + variants + last 30 days snapshots

## Jobs (Queue)
POST /api/jobs/enqueue
- body: { itemIds?: string[], mode: "all"|"selected", reason: "manual"|"scheduled" }

GET /api/jobs/next
- Auth: X-API-KEY = EXTENSION_API_KEY
- Returns next job (single concurrency)

## Snapshots (Extension -> Server)
POST /api/snapshots/batch
- body:
  item_id, url
  results: [{ option_key, price, status_code, raw_price_text? }]
  page_status_code
  checked_at

## Alerts
- Trigger when new_price < previous_7d_low OR previous_30d_low
- Send Slack webhook (if configured)
