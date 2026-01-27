# EXTENSION_NOTES.md — DOM strategy for the 3 sample pages

## Page signals observed
- Discount block can show: percent, original price, discounted price.
- Coupon block can show: "쿠폰받기", "쿠폰할인", and coupon-applied price.
- Base price label "쿠팡판매가" appears on some pages and should be preferred.

## Practical DOM strategy (multi-heuristic)
1) Find main product area by locating the product title (h1-like) and scanning nearby.
2) Price:
   - If element containing exact text "쿠팡판매가" exists:
     - read nearest following sibling/descendant containing a KRW number.
   - Else:
     - within main price block, collect all KRW-looking numbers,
     - filter out unit-price patterns (e.g., contains "당"),
     - pick the smallest among the "prominent" candidates (heuristic: bigger font / known container),
     - fallback: pick the last price in the discount block.
3) Options:
   - Locate option section by heading containing "개당" and "× 수량"
   - Identify option group chips/buttons for A (weight/volume) and B (count).
   - Click through combinations until N results, with cursor persistence.

## URL normalization must be applied before enqueueing jobs
- Avoid re-scraping same item under different tracking params.
