(() => {
  const PRICE_REGEX = /([\d,]+)\s*원/;

  const parsePrice = (text) => {
    const match = text.replace(/\s/g, "").match(PRICE_REGEX);
    if (!match) return null;
    return Number(match[1].replace(/,/g, ""));
  };

  const isBlocked = () => {
    const text = document.body.innerText;
    return (
      text.includes("접근이 제한") ||
      text.includes("로봇이 아닙니다") ||
      text.includes("CAPTCHA")
    );
  };

  const isSoldOut = () => {
    return Boolean(
      document.querySelector("[class*='soldout']") ||
        document.body.innerText.includes("품절")
    );
  };

  const extractPriceFromLabel = () => {
    const label = Array.from(document.querySelectorAll("span,div,dt,th")).find(
      (el) => el.textContent?.trim() === "쿠팡판매가"
    );
    if (!label) return null;
    const container = label.closest("div") ?? label.parentElement;
    if (!container) return null;
    const textCandidates = Array.from(container.querySelectorAll("*"))
      .map((el) => el.textContent ?? "")
      .filter((text) => PRICE_REGEX.test(text));
    for (const text of textCandidates) {
      const price = parsePrice(text);
      if (price != null) return price;
    }
    return null;
  };

  const extractFallbackPrice = () => {
    const priceTexts = Array.from(document.querySelectorAll("span,div"))
      .map((el) => el.textContent ?? "")
      .filter((text) => PRICE_REGEX.test(text))
      .filter((text) => !text.includes("%"))
      .filter((text) => !text.includes("당"))
      .filter((text) => !text.includes("쿠폰"));
    const prices = priceTexts
      .map(parsePrice)
      .filter((price) => price != null);
    if (prices.length === 0) return null;
    return Math.min(...prices);
  };

  const extractPrice = () => {
    const labeled = extractPriceFromLabel();
    if (labeled != null) {
      return { price: labeled, raw: "쿠팡판매가" };
    }
    const fallback = extractFallbackPrice();
    if (fallback != null) {
      return { price: fallback, raw: "fallback" };
    }
    return { price: null, raw: null };
  };

  const findOptionGroups = () => {
    // TODO: improve option grouping for multi-level 옵션 구조 (N개 이상)
    const headings = Array.from(document.querySelectorAll("h2,h3,dt,th,span"))
      .filter((el) => el.textContent?.includes("개당"))
      .map((el) => el.closest("section") ?? el.parentElement)
      .filter(Boolean);
    const groupRoots = headings.length ? headings : [document.body];
    const groupButtons = groupRoots.map((root) =>
      Array.from(
        root.querySelectorAll(
          "button, li[role='option'], a[role='button'], div[role='button']"
        )
      ).filter((el) => el.textContent?.trim())
    );
    return groupButtons.filter((group) => group.length > 0);
  };

  const buildOptionKeys = (groups) => {
    if (groups.length === 0) {
      return [{ key: "default", clicks: [] }];
    }
    if (groups.length === 1) {
      return groups[0].map((el) => ({
        key: el.textContent?.trim() ?? "option",
        clicks: [el]
      }));
    }
    const [groupA, groupB] = groups;
    const combos = [];
    for (const a of groupA) {
      for (const b of groupB) {
        combos.push({
          key: `${a.textContent?.trim()} / ${b.textContent?.trim()}`,
          clicks: [a, b]
        });
      }
    }
    return combos;
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  window.__pricewatchScrape = async ({
    variantLimit,
    variantCursor,
    pageTimeoutMs
  }) => {
    if (isBlocked()) {
      return {
        page_status_code: "BLOCK_SUSPECT",
        results: []
      };
    }

    const groups = findOptionGroups();
    const combos = buildOptionKeys(groups);
    const results = [];
    const total = combos.length;
    const start = variantCursor % Math.max(total, 1);
    const limit = Math.min(variantLimit, total || 1);

    const indices = [];
    for (let i = 0; i < limit; i += 1) {
      indices.push((start + i) % Math.max(total, 1));
    }

    for (const index of indices) {
      const combo = combos[index];
      for (const clickTarget of combo.clicks) {
        clickTarget.click();
        await wait(400);
      }
      await wait(400);
      const { price, raw } = extractPrice();
      const status = isSoldOut()
        ? "SOLD_OUT"
        : price == null
          ? "FAIL_SELECTOR"
          : "OK";
      results.push({
        option_key: combo.key,
        price,
        status_code: status,
        raw_price_text: raw
      });
    }

    if (results.length === 0) {
      const { price, raw } = extractPrice();
      results.push({
        option_key: "default",
        price,
        status_code: price == null ? "FAIL_SELECTOR" : "OK",
        raw_price_text: raw
      });
    }

    return {
      page_status_code: "OK",
      results,
      next_cursor: variantCursor + results.length,
      checked_at: new Date().toISOString(),
      elapsed_ms: pageTimeoutMs
    };
  };
})();
