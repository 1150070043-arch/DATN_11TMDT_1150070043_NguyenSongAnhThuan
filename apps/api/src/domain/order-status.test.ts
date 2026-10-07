import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionOrder, type OrderStatus } from "./order-status.js";

test("allows the complete happy-path order lifecycle", () => {
  const path: OrderStatus[] = ["pending", "confirmed", "shipping", "completed"];
  for (let index = 0; index < path.length - 1; index += 1) {
    assert.equal(canTransitionOrder(path[index]!, path[index + 1]!), true);
  }
});

test("allows cancellation only before shipping", () => {
  assert.equal(canTransitionOrder("pending", "cancelled"), true);
  assert.equal(canTransitionOrder("confirmed", "cancelled"), true);
  assert.equal(canTransitionOrder("shipping", "cancelled"), false);
  assert.equal(canTransitionOrder("completed", "cancelled"), false);
});

test("rejects backwards transitions and keeps retries idempotent", () => {
  assert.equal(canTransitionOrder("shipping", "confirmed"), false);
  assert.equal(canTransitionOrder("cancelled", "pending"), false);
  assert.equal(canTransitionOrder("completed", "completed"), true);
});
