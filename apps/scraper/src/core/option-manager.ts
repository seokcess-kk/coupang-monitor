/**
 * Option management utilities
 * Ported from apps/extension/src/content/option-iterator.ts
 */

import type { OptionGroup } from './types.js';

/**
 * Build option key string from labels
 * @example buildOptionKey(['3kg', '1개']) => '3kg / 1개'
 * @example buildOptionKey([]) => 'default'
 */
export function buildOptionKey(labels: string[]): string {
  const trimmed = labels.map((l) => l.trim()).filter(Boolean);
  if (trimmed.length === 0) return 'default';
  return trimmed.join(' / ');
}

/**
 * Generate all possible combinations of options
 * Uses cartesian product algorithm
 *
 * @example
 * generateOptionCombinations([
 *   { name: '중량', options: ['1kg', '2kg'] },
 *   { name: '수량', options: ['1개', '2개'] }
 * ])
 * // Returns: [['1kg', '1개'], ['1kg', '2개'], ['2kg', '1개'], ['2kg', '2개']]
 */
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

/**
 * Get variants for current run using round-robin cursor
 *
 * @param allCombinations - All possible option combinations
 * @param cursor - Current position in the round-robin
 * @param perRun - Number of variants to process per run
 * @returns variants to process and next cursor position
 */
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

/**
 * Check if all combinations have been processed
 */
export function isFullCycleComplete(
  totalCombinations: number,
  cursor: number,
  perRun: number
): boolean {
  if (totalCombinations === 0) return true;
  return cursor === 0 && totalCombinations <= perRun;
}
