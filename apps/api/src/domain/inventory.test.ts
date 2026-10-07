import assert from "node:assert/strict";
import test from "node:test";
import { calculateAdjustedStock } from "./inventory.js";

test("inventory adjustment computes valid receipts and write-offs", () => {
  assert.deepEqual(calculateAdjustedStock(12, 8), { ok: true, nextStock: 20 });
  assert.deepEqual(calculateAdjustedStock(12, -4), { ok: true, nextStock: 8 });
});

test("inventory adjustment rejects zero, negative balances and overflow", () => {
  assert.equal(calculateAdjustedStock(12, 0).ok, false);
  assert.deepEqual(calculateAdjustedStock(2, -3), { ok: false, code: "NEGATIVE_STOCK" });
  assert.deepEqual(calculateAdjustedStock(1_000_000, 1), { ok: false, code: "STOCK_LIMIT_EXCEEDED" });
});
