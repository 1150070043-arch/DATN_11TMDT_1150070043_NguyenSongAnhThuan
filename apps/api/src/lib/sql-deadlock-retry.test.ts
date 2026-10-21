import assert from "node:assert/strict";
import test from "node:test";
import { retrySqlDeadlock } from "./sql-deadlock-retry.js";

test("an aborted SQL deadlock can retry and return a single committed result", async () => {
  let attempts = 0, commits = 0;
  const result = await retrySqlDeadlock(async () => {
    if (++attempts < 3) throw { code: "EREQUEST", number: 1205 };
    commits++; return "committed";
  });
  assert.equal(result, "committed"); assert.equal(attempts, 3); assert.equal(commits, 1);
});
test("persistent deadlocks stop after three transaction attempts", async () => {
  let attempts = 0; const error = { code: "EREQUEST", number: 1205 };
  await assert.rejects(retrySqlDeadlock(async () => { attempts++; throw error; }), cause => cause === error);
  assert.equal(attempts, 3);
});
test("timeouts, duplicate keys and unknown commit outcomes never retry", async () => {
  for (const error of [{ code: "ETIMEOUT", number: 1205 }, { code: "EREQUEST", number: 2627 }, new Error("unknown outcome")]) {
    let attempts = 0;
    await assert.rejects(retrySqlDeadlock(async () => { attempts++; throw error; }), cause => cause === error);
    assert.equal(attempts, 1);
  }
});
