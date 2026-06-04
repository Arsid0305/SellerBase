import { describe, expect, it } from 'vitest';
import { classifyLifecycle } from './classifier';
import type { LifecycleInput } from './types';

const base: LifecycleInput = {
  isActive: true,
  daysInCatalog: 60,
  daysSinceLastSale: 1,
  revenue14d: 100,
  revenue14dPrev: 100,
  marginPct: 30,
  stock: 100,
  unitsPerDay: 2,
  isTopRevenue: false,
};

describe('classifyLifecycle', () => {
  it('ARCHIVED: isActive=false dominates everything else', () => {
    expect(classifyLifecycle({ ...base, isActive: false })).toBe('ARCHIVED');
    expect(
      classifyLifecycle({ ...base, isActive: false, stock: 0, unitsPerDay: 5 }),
    ).toBe('ARCHIVED');
  });

  it('CRITICAL: stock 0 with demand', () => {
    expect(classifyLifecycle({ ...base, stock: 0, unitsPerDay: 3 })).toBe('CRITICAL');
  });

  it('CRITICAL: stock 0 with negative number is also out-of-stock', () => {
    expect(classifyLifecycle({ ...base, stock: -1, unitsPerDay: 1 })).toBe('CRITICAL');
  });

  it('CRITICAL: stock exists, no sales > 14 days', () => {
    expect(classifyLifecycle({ ...base, stock: 50, daysSinceLastSale: 15 })).toBe('CRITICAL');
  });

  it('not CRITICAL on stale boundary == 14', () => {
    // > 14 condition; 14 itself should not trigger CRITICAL
    const r = classifyLifecycle({ ...base, daysSinceLastSale: 14 });
    expect(r).not.toBe('CRITICAL');
  });

  it('NEW: daysInCatalog < 14', () => {
    expect(classifyLifecycle({ ...base, daysInCatalog: 0 })).toBe('NEW');
    expect(classifyLifecycle({ ...base, daysInCatalog: 13 })).toBe('NEW');
  });

  it('boundary daysInCatalog == 14 is no longer NEW', () => {
    expect(classifyLifecycle({ ...base, daysInCatalog: 14 })).not.toBe('NEW');
  });

  it('LEADER: top + margin >= 25 + not falling', () => {
    expect(
      classifyLifecycle({
        ...base,
        isTopRevenue: true,
        marginPct: 25,
        revenue14d: 100,
        revenue14dPrev: 100,
      }),
    ).toBe('LEADER');
  });

  it('LEADER tolerates -20% drop exactly', () => {
    expect(
      classifyLifecycle({
        ...base,
        isTopRevenue: true,
        marginPct: 30,
        revenue14d: 80,
        revenue14dPrev: 100,
      }),
    ).toBe('LEADER');
  });

  it('not LEADER when margin < 25', () => {
    const r = classifyLifecycle({
      ...base,
      isTopRevenue: true,
      marginPct: 24,
      revenue14d: 100,
      revenue14dPrev: 100,
    });
    expect(r).not.toBe('LEADER');
  });

  it('GROWING: delta >= +20%', () => {
    expect(
      classifyLifecycle({ ...base, revenue14d: 120, revenue14dPrev: 100 }),
    ).toBe('GROWING');
  });

  it('GROWING when prev=0 and cur>0', () => {
    expect(
      classifyLifecycle({ ...base, revenue14d: 50, revenue14dPrev: 0 }),
    ).toBe('GROWING');
  });

  it('DECLINING: delta <= -20%', () => {
    expect(
      classifyLifecycle({ ...base, revenue14d: 80, revenue14dPrev: 100 }),
    ).toBe('DECLINING');
  });

  it('STABLE: |delta| < 20%', () => {
    expect(
      classifyLifecycle({ ...base, revenue14d: 110, revenue14dPrev: 100 }),
    ).toBe('STABLE');
    expect(
      classifyLifecycle({ ...base, revenue14d: 90, revenue14dPrev: 100 }),
    ).toBe('STABLE');
  });

  it('STABLE when prev=0 and cur=0', () => {
    expect(
      classifyLifecycle({ ...base, revenue14d: 0, revenue14dPrev: 0 }),
    ).toBe('STABLE');
  });
});
