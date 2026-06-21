import { describe, expect, it } from 'vitest';
import { classifyTurnover } from '../classifier';

describe('classifyTurnover', () => {
  describe('unstable', () => {
    it('unitsPerDay=0 → unstable (нет продаж)', () => {
      expect(classifyTurnover(50, 0)).toBe('unstable');
    });

    it('unitsPerDay<0 (битые данные) → unstable', () => {
      expect(classifyTurnover(50, -0.5)).toBe('unstable');
    });

    it('daysToOos<7 (заканчивается) → unstable', () => {
      expect(classifyTurnover(0, 1)).toBe('unstable');
      expect(classifyTurnover(6.9, 1)).toBe('unstable');
    });

    it('daysToOos>180 (избыточный сток) → unstable', () => {
      expect(classifyTurnover(181, 1)).toBe('unstable');
      expect(classifyTurnover(365, 1)).toBe('unstable');
    });
  });

  describe('stable', () => {
    it('30 ≤ daysToOos ≤ 90 → stable', () => {
      expect(classifyTurnover(30, 1)).toBe('stable');
      expect(classifyTurnover(60, 1)).toBe('stable');
      expect(classifyTurnover(90, 1)).toBe('stable');
    });
  });

  describe('medium', () => {
    it('7-30 дней (между unstable и stable снизу) → medium', () => {
      expect(classifyTurnover(7, 1)).toBe('medium');
      expect(classifyTurnover(20, 1)).toBe('medium');
      expect(classifyTurnover(29.9, 1)).toBe('medium');
    });

    it('90-180 дней (между stable и unstable сверху) → medium', () => {
      expect(classifyTurnover(91, 1)).toBe('medium');
      expect(classifyTurnover(150, 1)).toBe('medium');
      expect(classifyTurnover(180, 1)).toBe('medium');
    });
  });

  describe('boundaries (точные пороги)', () => {
    it('daysToOos=6.999 → unstable (порог <7)', () => {
      expect(classifyTurnover(6.999, 1)).toBe('unstable');
    });
    it('daysToOos=7 → medium', () => {
      expect(classifyTurnover(7, 1)).toBe('medium');
    });
    it('daysToOos=30 → stable (нижняя граница)', () => {
      expect(classifyTurnover(30, 1)).toBe('stable');
    });
    it('daysToOos=90 → stable (верхняя граница)', () => {
      expect(classifyTurnover(90, 1)).toBe('stable');
    });
    it('daysToOos=90.1 → medium', () => {
      expect(classifyTurnover(90.1, 1)).toBe('medium');
    });
    it('daysToOos=180 → medium (верхняя граница)', () => {
      expect(classifyTurnover(180, 1)).toBe('medium');
    });
    it('daysToOos=180.1 → unstable', () => {
      expect(classifyTurnover(180.1, 1)).toBe('unstable');
    });
  });

  describe('приоритет: unitsPerDay=0 поглощает все другие условия', () => {
    it('unitsPerDay=0 + daysToOos=60 (был бы stable) → unstable', () => {
      expect(classifyTurnover(60, 0)).toBe('unstable');
    });
  });
});
