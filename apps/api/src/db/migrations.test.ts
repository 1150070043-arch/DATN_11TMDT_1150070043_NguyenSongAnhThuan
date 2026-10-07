import assert from "node:assert/strict";
import test from "node:test";
import { migrationChecksum, migrations, validateMigrations } from "./migrations.js";

test("database migrations are ordered, named and immutable by checksum", () => {
  assert.doesNotThrow(() => validateMigrations());
  assert.deepEqual(migrations.map((migration) => migration.version), [1, 2, 3, 4]);
  for (const migration of migrations) {
    assert.match(migrationChecksum(migration), /^[a-f0-9]{64}$/);
  }
});

test("database migration validation rejects duplicate or unordered versions", () => {
  assert.throws(() => validateMigrations([
    { version: 2, name: "valid_second", sql: "SELECT 1" },
    { version: 2, name: "duplicate_second", sql: "SELECT 2" }
  ]));
});
