/**
 * Extract product name from Coupang product page
 */

const NAME_SELECTORS = [
    // 최신 쿠팡 선택자 (2026-02 기준, 최우선)
    "h1.product-title span.twc-font-bold",
    "h1.product-title",
    ".product-buy-header h1.product-title",
    // 기존 선택자
    ".prod-buy-header h1",
    ".prod-buy-header h2",
    ".prod-buy-header .prod-buy-header__title",
    "h1.prod-buy-header__title",
    "h2.prod-buy-header__title",
    ".prod-buy-header__title",
    "h1.prod-title",
    ".product-name h1",
    // Fallback selectors
    ".prod-buy-header [class*='title']",
    "[class*='product-title']",
    "[class*='productTitle']",
    "h1[class*='title']",
    // 최종 폴백
    "h1",
];

export function extractProductName(document: Document): string | null {
    // Try each selector in order of priority
    for (const selector of NAME_SELECTORS) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent?.trim();
            if (text && text.length > 0) {
                return text;
            }
        }
    }

    // Fallback: Extract from document title
    // Coupang titles are typically in format: "Product Name - 쿠팡!"
    const docTitle = document.title;
    if (docTitle) {
        // Remove common suffixes
        const cleaned = docTitle
            .replace(/\s*[-|]\s*쿠팡!?\s*$/i, "")
            .replace(/\s*[-|]\s*Coupang\s*$/i, "")
            .trim();

        if (cleaned && cleaned.length > 0) {
            return cleaned;
        }
    }

    return null;
}
