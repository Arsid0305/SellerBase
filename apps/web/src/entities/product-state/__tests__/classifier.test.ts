import { describe, expect, it } from 'vitest';
import { classifyLifecycle } from '../classifier';
import type { LifecycleInput } from '../types';

function base(overrides: Partial<LifecycleInput> = {}): LifecycleInput {
  return {
    isActive: true,
    daysInCatalog: 90,
    daysSinceLastSale: 1,
    revenue14d: 1000,
    revenue14dPrev: 1000,
    marginPct: 15,
    stock: 50,
    unitsPerDay: 1,
    isTopRevenue: false,
    ...overrides,
  };
}

describe('classifyLifecycle', () => {
  describe('ARCHIVED', () => {
    it('isActive=false → ARCHIVED (любые остальные параметры игнорируются)', () => {
      expect(classifyLifecycle(base({ isActive: false }))).toBe('ARCHIVED');
      expect(classifyLifecycle(base({ isActive: false, stock: 0, unitsPerDay: 100 }))).toBe('ARCHIVED');
    });
  });

  describe('CRITICAL', () => {
    it('stock=0 и спрос есть → CRITICAL', () => {
      expect(classifyLifecycle(base({ stock: 0, unitsPerDay: 1 }))).toBe('CRITICAL');
    });

    it('stock<0 (отрицательный из-за возвратов) и спрос → CRITICAL', () => {
      expect(classifyLifecycle(base({ stock: -1, unitsPerDay: 0.5 }))).toBe('CRITICAL');
    });

    it('stock=0 без спроса → НЕ CRITICAL (упадёт в DECLINING/STABLE)', () => {
      expect(classifyLifecycle(base({ stock: 0, unitsPerDay: 0 }))).not.toBe('CRITICAL');
    });

    it('сток есть, но >14 дней без продаж → CRITICAL', () => {
      expect(classifyLifecycle(base({ stock: 10, daysSinceLastSale: 15 }))).toBe('CRITICAL');
    });

    it('сток есть, ровно 14 дней без продаж → НЕ CRITICAL (граница)', () => {
      expect(classifyLifecycle(base({ stock: 10, daysSinceLastSale: 14 }))).not.toBe('CRITICAL');
    });
  });

  describe('NEW', () => {
    it('daysInCatalog<14 → NEW (после прохождения CRITICAL-чеков)', () => {
      expect(classifyLifecycle(base({ daysInCatalog: 5 }))).toBe('NEW');
      expect(classifyLifecycle(base({ daysInCatalog: 13 }))).toBe('NEW');
    });

    it('daysInCatalog=14 → НЕ NEW (граница)', () => {
      expect(classifyLifecycle(base({ daysInCatalog: 14 }))).not.toBe('NEW');
    });

    it('CRITICAL имеет приоритет над NEW', () => {
      expect(classifyLifecycle(base({ daysInCatalog: 5, stock: 0, unitsPerDay: 1 }))).toBe('CRITICAL');
    });
  });

  describe('LEADER', () => {
    it('топ + marginPct≥20 + не падает → LEADER', () => {
      expect(classifyLifecycle(base({ isTopRevenue: true, marginPct: 25, revenue14d: 1000, revenue14dPrev: 900 }))).toBe('LEADER');
    });

    it('marginPct=20 (граница) → LEADER', () => {
      expect(classifyLifecycle(base({ isTopRevenue: true, marginPct: 20, revenue14d: 1000, revenue14dPrev: 1000 }))).toBe('LEADER');
    });

    it('marginPct=19 → НЕ LEADER (упадёт в STABLE)', () => {
      expect(classifyLifecycle(base({ isTopRevenue: true, marginPct: 19, revenue14d: 1000, revenue14dPrev: 1000 }))).toBe('STABLE');
    });

    it('топ + marginPct=25, но падение -25% → НЕ LEADER', () => {
      expect(classifyLifecycle(base({ isTopRevenue: true, marginPct: 25, revenue14d: 750, revenue14dPrev: 1000 }))).toBe('DECLINING');
    });

    it('не топ → НЕ LEADER даже с большой маржой', () => {
      expect(classifyLifecycle(base({ isTopRevenue: false, marginPct: 50 }))).not.toBe('LEADER');
    });
  });

  describe('GROWING / DECLINING / STABLE', () => {
    it('рост ≥20% → GROWING', () => {
      expect(classifyLifecycle(base({ revenue14d: 1200, revenue14dPrev: 1000 }))).toBe('GROWING');
      expect(classifyLifecycle(base({ revenue14d: 2000, revenue14dPrev: 1000 }))).toBe('GROWING');
    });

    it('падение ≥20% → DECLINING', () => {
      expect(classifyLifecycle(base({ revenue14d: 800, revenue14dPrev: 1000 }))).toBe('DECLINING');
      expect(classifyLifecycle(base({ revenue14d: 0, revenue14dPrev: 1000 }))).toBe('DECLINING');
    });

    it('колебание ±19% → STABLE', () => {
      expect(classifyLifecycle(base({ revenue14d: 1190, revenue14dPrev: 1000 }))).toBe('STABLE');
      expect(classifyLifecycle(base({ revenue14d: 810, revenue14dPrev: 1000 }))).toBe('STABLE');
    });

    it('новый продукт без истории (prev=0, cur>0) → GROWING (deltaRatio=1)', () => {
      expect(classifyLifecycle(base({ revenue14d: 500, revenue14dPrev: 0 }))).toBe('GROWING');
    });

    it('prev=0 и cur=0 → STABLE (deltaRatio=0)', () => {
      expect(classifyLifecycle(base({ revenue14d: 0, revenue14dPrev: 0 }))).toBe('STABLE');
    });
  });

  describe('Приоритет правил (из VISION.md)', () => {
    it('ARCHIVED > CRITICAL', () => {
      expect(classifyLifecycle(base({ isActive: false, stock: 0, unitsPerDay: 1 }))).toBe('ARCHIVED');
    });

    it('CRITICAL > NEW', () => {
      expect(classifyLifecycle(base({ daysInCatalog: 3, stock: 0, unitsPerDay: 1 }))).toBe('CRITICAL');
    });

    it('NEW > LEADER', () => {
      expect(classifyLifecycle(base({ daysInCatalog: 5, isTopRevenue: true, marginPct: 50 }))).toBe('NEW');
    });

    it('LEADER > GROWING', () => {
      expect(classifyLifecycle(base({ isTopRevenue: true, marginPct: 30, revenue14d: 2000, revenue14dPrev: 1000 }))).toBe('LEADER');
    });
  });
});
