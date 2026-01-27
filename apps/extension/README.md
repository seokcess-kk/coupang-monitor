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

## Local config
The extension reads the following from Chrome storage (default values are used if not set):
- `apiBaseUrl`: `http://localhost:3000`
- `apiKey`: `dev_key_change_me`

Use the Chrome devtools console on the extension service worker to set values:
```js
chrome.storage.local.set({ apiBaseUrl: "http://localhost:3000", apiKey: "dev_key_change_me" })
```
