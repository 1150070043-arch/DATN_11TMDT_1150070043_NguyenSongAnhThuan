import assert from "node:assert/strict";
import test from "node:test";
import { books, sampleOrderCount } from "./seed.js";

test("seed data matches the thesis scope", () => {
  assert.ok(books.length >= 30 && books.length <= 50);
  assert.ok(sampleOrderCount >= 50 && sampleOrderCount <= 100);
});

test("book identifiers and slugs stay unique", () => {
  assert.equal(new Set(books.map((book) => book.id)).size, books.length);
  assert.equal(new Set(books.map((book) => book.slug)).size, books.length);
  assert.ok(books.every((book) => book.stock >= 0 && book.price >= 0));
});
