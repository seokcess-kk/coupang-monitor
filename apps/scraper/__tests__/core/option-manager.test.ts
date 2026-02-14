/**
 * Option manager tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildOptionKey,
  generateOptionCombinations,
  getVariantsForRun,
} from '../../src/core/option-manager.js';

describe('buildOptionKey', () => {
  it('builds key from multiple labels', () => {
    expect(buildOptionKey(['3kg', '1개'])).toBe('3kg / 1개');
    expect(buildOptionKey(['빨강', '대형', '2개'])).toBe('빨강 / 대형 / 2개');
  });

  it('trims whitespace', () => {
    expect(buildOptionKey(['  3kg  ', '  1개  '])).toBe('3kg / 1개');
  });

  it('returns default for empty array', () => {
    expect(buildOptionKey([])).toBe('default');
  });

  it('filters out empty strings', () => {
    expect(buildOptionKey(['3kg', '', '1개'])).toBe('3kg / 1개');
  });
});

describe('generateOptionCombinations', () => {
  it('returns empty array wrapper for no groups', () => {
    expect(generateOptionCombinations([])).toEqual([[]]);
  });

  it('generates combinations for single group', () => {
    const groups = [{ name: '수량', options: ['1개', '2개', '3개'] }];
    const result = generateOptionCombinations(groups);
    expect(result).toEqual([['1개'], ['2개'], ['3개']]);
  });

  it('generates cartesian product for multiple groups', () => {
    const groups = [
      { name: '중량', options: ['1kg', '2kg'] },
      { name: '수량', options: ['1개', '2개'] },
    ];
    const result = generateOptionCombinations(groups);
    expect(result).toEqual([
      ['1kg', '1개'],
      ['1kg', '2개'],
      ['2kg', '1개'],
      ['2kg', '2개'],
    ]);
  });

  it('handles three groups', () => {
    const groups = [
      { name: '색상', options: ['빨강', '파랑'] },
      { name: '크기', options: ['S', 'L'] },
      { name: '수량', options: ['1개'] },
    ];
    const result = generateOptionCombinations(groups);
    expect(result).toHaveLength(4); // 2 * 2 * 1
    expect(result).toContainEqual(['빨강', 'S', '1개']);
    expect(result).toContainEqual(['파랑', 'L', '1개']);
  });
});

describe('getVariantsForRun', () => {
  const combinations = [
    ['A', '1'],
    ['A', '2'],
    ['B', '1'],
    ['B', '2'],
    ['C', '1'],
    ['C', '2'],
  ];

  it('returns first N variants from start', () => {
    const result = getVariantsForRun(combinations, 0, 3);
    expect(result.variants).toEqual([['A', '1'], ['A', '2'], ['B', '1']]);
    expect(result.nextCursor).toBe(3);
  });

  it('wraps around at end', () => {
    const result = getVariantsForRun(combinations, 4, 3);
    expect(result.variants).toEqual([['C', '1'], ['C', '2'], ['A', '1']]);
    expect(result.nextCursor).toBe(1);
  });

  it('handles perRun larger than total', () => {
    const result = getVariantsForRun(combinations, 0, 10);
    expect(result.variants).toHaveLength(6); // All combinations
    expect(result.nextCursor).toBe(0);
  });

  it('handles empty combinations', () => {
    const result = getVariantsForRun([], 0, 15);
    expect(result.variants).toEqual([[]]);
    expect(result.nextCursor).toBe(0);
  });

  it('returns correct cursor for exact fit', () => {
    const result = getVariantsForRun(combinations, 0, 6);
    expect(result.variants).toHaveLength(6);
    expect(result.nextCursor).toBe(0);
  });
});
