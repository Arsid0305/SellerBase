import { describe, expect, it } from 'vitest';
import { formatDelta, formatInt, formatRub } from './format';

describe('format helpers', () => {
  it('formatRub formats thousands with a space separator', () => {
    expect(formatRub(1000)).toMatch(/1\s000/);
  });

  it('formatInt formats millions with space separators', () => {
    expect(formatInt(1234567)).toMatch(/1\s234\s567/);
  });

  it('formatDelta(null) returns em dash', () => {
    expect(formatDelta(null)).toBe('—');
  });

  it('formatDelta(5) returns +5%', () => {
    expect(formatDelta(5)).toBe('+5%');
  });

  it('formatDelta(-3) returns -3%', () => {
    expect(formatDelta(-3)).toBe('-3%');
  });
});
