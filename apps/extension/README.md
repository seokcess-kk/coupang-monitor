# PriceWatch Chrome Extension (MV3)

## Behavior
- Pull job: GET /api/jobs/next
- Open URL in a tab (concurrency=1)
- Read displayed base price (exclude coupons)
- Iterate options up to N per run (round-robin)
- POST /api/snapshots/batch
- Timeout: 20s

## Status Codes
OK | SOLD_OUT | TIMEOUT | FAIL_SELECTOR | BLOCK_SUSPECT
