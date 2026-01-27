export function buildOptionKey(labels: string[]): string {
  const trimmed = labels.map((l) => l.trim()).filter(Boolean);
  if (trimmed.length === 0) return "default";
  return trimmed.join(" / ");
}

export interface OptionGroup {
  name: string;
  options: string[];
}

export function detectOptionGroups(document: Document): OptionGroup[] {
  const groups: OptionGroup[] = [];

  // Look for option section headings with patterns like "개당 × 수량"
  const headings = document.querySelectorAll(
    "[class*='option'] [class*='title'], [class*='option'] [class*='header'], [class*='option'] h3, [class*='option'] h4"
  );

  for (const heading of headings) {
    const text = heading.textContent?.trim() ?? "";
    if (!text) continue;

    // Find option chips/buttons within this group
    const parent = heading.parentElement;
    if (!parent) continue;

    const optionEls = parent.querySelectorAll(
      "button, li[role='option'], [class*='option-item'], [class*='chip']"
    );

    const options: string[] = [];
    for (const el of optionEls) {
      const label = el.textContent?.trim();
      if (label) options.push(label);
    }

    if (options.length > 0) {
      groups.push({ name: text, options });
    }
  }

  return groups;
}

export function generateOptionCombinations(groups: OptionGroup[]): string[][] {
  if (groups.length === 0) return [[]];

  const result: string[][] = [];

  function combine(groupIdx: number, current: string[]) {
    if (groupIdx >= groups.length) {
      result.push([...current]);
      return;
    }

    for (const option of groups[groupIdx].options) {
      current.push(option);
      combine(groupIdx + 1, current);
      current.pop();
    }
  }

  combine(0, []);
  return result;
}

export function getVariantsForRun(
  allCombinations: string[][],
  cursor: number,
  perRun: number
): { variants: string[][]; nextCursor: number } {
  if (allCombinations.length === 0) {
    return { variants: [[]], nextCursor: 0 };
  }

  const total = allCombinations.length;
  const start = cursor % total;
  const variants: string[][] = [];

  for (let i = 0; i < Math.min(perRun, total); i++) {
    const idx = (start + i) % total;
    variants.push(allCombinations[idx]);
  }

  const nextCursor = (start + variants.length) % total;
  return { variants, nextCursor };
}
