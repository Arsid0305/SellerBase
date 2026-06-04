/**
 * Чистая функция вычисления z-score для baseline-наблюдений и target-значения.
 * Возвращает 0, если выборка пустая или std == 0 (некорректный delta).
 */
export function computeAnomalyZScore(values: number[], target: number): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (target - mean) / std;
}
