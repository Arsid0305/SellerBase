import { describe, expect, it } from 'vitest';
import { bucketDate } from './granularity';

describe('bucketDate', () => {
  it('day granularity returns YYYY-MM-DD', () => {
    expect(bucketDate(new Date('2026-06-18'), 'day')).toBe('2026-06-18');
  });

  it('month granularity returns YYYY-MM', () => {
    expect(bucketDate(new Date('2026-06-18'), 'month')).toBe('2026-06');
  });

  it('year granularity returns YYYY', () => {
    expect(bucketDate(new Date('2026-06-18'), 'year')).toBe('2026');
  });

  it('quarter granularity returns YYYY-Qn', () => {
    expect(bucketDate(new Date('2026-06-18'), 'quarter')).toBe('2026-Q2');
  });
});
