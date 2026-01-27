# URL_NORMALIZATION.md

## Input examples (from user)
https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522&q=...&rank=1...
https://www.coupang.com/vp/products/1867265?itemId=21121876883&vendorItemId=3000107644&q=...&rank=3...
https://www.coupang.com/vp/products/4788701784?itemId=6132225851&vendorItemId=88470546639&q=...&rank=9...

## Canonical form
https://www.coupang.com/vp/products/{productId}?itemId={itemId}&vendorItemId={vendorItemId}

## Dedupe key
{productId}:{itemId}:{vendorItemId}

## Drop params
q, searchId, sourceType, itemsCount, searchRank, rank, traceId, etc.
