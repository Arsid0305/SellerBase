import { describe, expect, it } from 'vitest';
import { formatCompact, formatInt, formatRub } from './format';

// Normalise NBSP / narrow-NBSP that ru-RU Intl emits — makes assertions robust
const norm = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatRub', () => {
  it('formats positive integer with RUB suffix', () => {
    expect(norm(formatRub(1234))).toMatch(/1\s?234\s?₽/);
  });

  it('formats zero', () => {
    expect(norm(formatRub(0))).toMatch(/0\s?₽/);
  });

  it('formats negative', () => {
    const out = norm(formatRub(-500));
    expect(out).toContain('500');
    expect(out).toMatch(/-|−/);
  });

  it('drops fractional part (maximumFractionDigits=0)', () => {
    const out = norm(formatRub(1234.78));
    expect(out).not.toContain(',');
    expect(out).toMatch(/1\s?235\s?₽/);
  });
});

describe('formatInt', () => {
  it('groups thousands with separator', () => {
    expect(norm(formatInt(1234567))).toBe('1 234 567');
  });

  it('handles zero', () => {
    expect(formatInt(0)).toBe('0');
  });

  it('handles negative', () => {
    expect(norm(formatInt(-1234))).toMatch(/[-−]1 234/);
  });

  it('rounds floats', () => {
    expect(norm(formatInt(99.6))).toBe('100');
  });
});

describe('formatCompact', () => {
  it('formats thousands as compact ru', () => {
    const out = norm(formatCompact(1500));
    expect(out).toMatch(/тыс/);
  });

  it('formats millions as compact ru', () => {
    const out = norm(formatCompact(2_500_000));
    expect(out).toMatch(/млн/);
  });

  it('formats zero', () => {
    expect(formatCompact(0)).toBe('0');
  });

  it('formats negative', () => {
    const out = norm(formatCompact(-1500));
    expect(out).toMatch(/[-−]/);
    expect(out).toMatch(/тыс/);
  });
});
