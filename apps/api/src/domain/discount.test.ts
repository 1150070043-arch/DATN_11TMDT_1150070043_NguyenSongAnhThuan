import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateDiscount } from "./discount.js";

describe("calculateDiscount", () => {
  it("applies percentage discounts with a cap", () => {
    assert.equal(calculateDiscount(1_000_000, { type: "percent", value: 20, maximumDiscount: 120_000 }), 120_000);
  });
  it("does not discount orders below the minimum", () => {
    assert.equal(calculateDiscount(90_000, { type: "fixed", value: 30_000, minimumOrder: 100_000 }), 0);
  });
  it("never creates a negative total", () => {
    assert.equal(calculateDiscount(20_000, { type: "fixed", value: 50_000 }), 20_000);
  });
});
