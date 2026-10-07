export const maximumStock = 1_000_000;

export type StockAdjustmentResult =
  | { ok: true; nextStock: number }
  | { ok: false; code: "INVALID_ADJUSTMENT" | "NEGATIVE_STOCK" | "STOCK_LIMIT_EXCEEDED" };

export function calculateAdjustedStock(currentStock: number, delta: number): StockAdjustmentResult {
  if (!Number.isSafeInteger(currentStock) || !Number.isSafeInteger(delta) || currentStock < 0 || delta === 0) {
    return { ok: false, code: "INVALID_ADJUSTMENT" };
  }
  const nextStock = currentStock + delta;
  if (nextStock < 0) return { ok: false, code: "NEGATIVE_STOCK" };
  if (nextStock > maximumStock) return { ok: false, code: "STOCK_LIMIT_EXCEEDED" };
  return { ok: true, nextStock };
}
