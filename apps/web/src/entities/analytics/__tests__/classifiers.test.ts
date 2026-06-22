import { describe, expect, it } from 'vitest';
import { classifyProfit, classifySales, classifyStability } from '../classifiers';

describe('classifyProfit', () => {
  it('≥30 → PPP', () => {
    expect(classifyProfit(30)).toBe('PPP');
    expect(classifyProfit(50)).toBe('PPP');
  });

  it('15..30 → PP', () => {
    expect(classifyProfit(15)).toBe('PP');
    expect(classifyProfit(20)).toBe('PP');
    expect(classifyProfit(29.99)).toBe('PP');
  });

  it('0..15 → P', () => {
    expect(classifyProfit(0)).toBe('P');
    expect(classifyProfit(7.5)).toBe('P');
    expect(classifyProfit(14.99)).toBe('P');
  });

  it('<0 → -P', () => {
    expect(classifyProfit(-0.01)).toBe('-P');
    expect(classifyProfit(-100)).toBe('-P');
  });
});

describe('classifyStability', () => {
  it('< 7 точек → Z', () => {
    expect(classifyStability([1, 1, 1, 1, 1, 1])).toBe('Z');
    expect(classifyStability([])).toBe('Z');
  });

  it('mean ≤ 0 → Z', () => {
    expect(classifyStability([0, 0, 0, 0, 0, 0, 0])).toBe('Z');
  });

  it('идеально стабильный ряд (cv = 0) → X', () => {
    expect(classifyStability([5, 5, 5, 5, 5, 5, 5])).toBe('X');
  });

  it('умеренный разброс (cv ≈ 0.155) → Y', () => {
    expect(classifyStability([4, 5, 6, 4, 5, 6, 4, 5, 6, 5])).toBe('Y');
  });

  it('сильный разброс (cv > 0.25) → Z', () => {
    expect(classifyStability([0, 0, 10, 0, 0, 10, 0])).toBe('Z');
  });
});

describe('classifySales', () => {
  it('пустой массив → пустой Map', () => {
    expect(classifySales([]).size).toBe(0);
  });

  it('total = 0 → все C', () => {
    const m = classifySales([
      { id: 1, revenue: 0 },
      { id: 2, revenue: 0 },
    ]);
    expect(m.get(1)).toBe('C');
    expect(m.get(2)).toBe('C');
  });

  it('кумулятивная классификация ABC', () => {
    // total=100; кумул %: 70/100=70 → A; 90 → B (>80,≤95); 95 → B (≤95); 100 → C
    const m = classifySales([
      { id: 1, revenue: 70 },
      { id: 2, revenue: 20 },
      { id: 3, revenue: 5 },
      { id: 4, revenue: 5 },
    ]);
    expect(m.get(1)).toBe('A');
    expect(m.get(2)).toBe('B');
    expect(m.get(3)).toBe('B');
    expect(m.get(4)).toBe('C');
  });

  it('одиночный SKU (cumulative = 100%) → C (фиксирует поведение)', () => {
    const m = classifySales([{ id: 1, revenue: 100 }]);
    expect(m.get(1)).toBe('C');
  });
});
