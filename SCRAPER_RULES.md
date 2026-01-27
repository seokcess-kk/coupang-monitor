# SCRAPER_RULES.md — Coupang Product Detail (based on 3 sample URLs)

## 0) Goal
- Extract "displayed base price" (표시가) and option-level prices.
- Exclude coupon/personalized benefits; prefer "쿠팡판매가" when present.
- Handle many options via N-per-run + round-robin cursor.

## 1) URL normalization (critical)
Input URLs include tracking params (q, searchId, rank, traceId, etc).
Normalize to:
- base: https://www.coupang.com/vp/products/{productId}
- keep only: itemId, vendorItemId (if present)
- drop everything else

Example:
/ vp / products / 212842 ? itemId=9314840&vendorItemId=3000290522  (keep)
/ vp / products / 212842 ? ... &q=...&searchId=...&rank=... (drop)

Key strategy:
- item_key = "{productId}:{itemId}:{vendorItemId?}"
- Store productId + itemId + vendorItemId separately.

## 2) Price extraction priority (displayed base price)
Priority order:
A) If text/DOM label "쿠팡판매가" exists:
   - Use the numeric price immediately associated with "쿠팡판매가"
   - Rationale: sample pages show discounted price and coupon price, but base is labeled explicitly.
B) Else (no "쿠팡판매가" visible):
   - Use "final displayed price" in the main price block:
     - Prefer the lowest prominent price near discount block (e.g., after original price).
   - Exclude:
     - percent (e.g., 25%)
     - unit price like "(100g당 993원)" or "(100ml당 590원)"
     - coupon discount amounts (e.g., "1,000원", "쿠폰할인")

Parsing rules:
- price_int = parseInt(remove(',', '').remove('원').trim())
- Keep optional raw_price_text for debugging.

Observed samples:
- Sample A has "쿠팡판매가 14,650원" and "쿠폰할인 1,000원" => use 14,650
- Sample B has "19,900원" then "14,900원" (no 쿠팡판매가 label) => use 14,900
- Sample C has "쿠팡판매가 22,550원" and "쿠폰할인 1,030원" => use 22,550

## 3) Option extraction (variants)
Goal: option_key captures selected option combination.

Observed option patterns:
- Pattern 1: "개당 중량 × 수량" then weight options + quantity options with prices
- Pattern 2: "개당 용량 × 수량" then volume options + quantity options with prices
- "모든 옵션 보기" or "더 많은 옵션 보기" may appear.

Approach:
- Detect option groups (Group A/B) by scanning for headings containing:
  - "개당" and "× 수량"
- In DOM, treat clickable option elements as candidates:
  - buttons, li[role=option], a, div[role=button] within option area.
- Build option_key by concatenating selected labels:
  - e.g. "3kg / 1개" or "2L / 2개"

N-per-run + Round-robin:
- Flatten all option combinations if feasible; otherwise:
  - iterate options in a deterministic order
  - maintain item.variant_cursor (index) to continue next run
- Default N = 15 variants per run.

Wait strategy:
- After clicking an option:
  - wait until price text changes OR a short debounce (e.g. 300~800ms)
  - then capture price (using price rules above)

## 4) Status codes
OK
SOLD_OUT        (detect "품절" / disabled purchase)
TIMEOUT         (page not loaded within PAGE_TIMEOUT_MS)
FAIL_SELECTOR   (cannot locate price block or option area)
BLOCK_SUSPECT   (unexpected interstitial / access denied / captcha-like)

## 5) What to store per upload
Per variant result:
- option_key
- price (Int)
- status_code
- checked_at
- raw_price_text (optional)
