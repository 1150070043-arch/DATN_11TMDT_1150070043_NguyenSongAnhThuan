import assert from 'node:assert/strict';
import test from 'node:test';
import type sql from 'mssql';
import { cleanupAuthBatch, previewAuthCleanup } from './auth-cleanup.js';
import { startAuthCleanupWorker } from './auth-cleanup-worker.js';

async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

test('maintenance never overlaps and shutdown waits for the active run', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const stop = startAuthCleanupWorker(1000, async () => { calls++; await pending; });
  await settle(); assert.equal(calls, 1);
  t.mock.timers.tick(5000); await settle(); assert.equal(calls, 1);
  let stopped = false;
  const stopping = stop().then(() => { stopped = true; });
  await settle(); assert.equal(stopped, false);
  release(); await stopping; assert.equal(stopped, true);
  t.mock.timers.tick(5000); await settle(); assert.equal(calls, 1);
});

test('maintenance recovers on the next interval after a failed run', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let calls = 0;
  const stop = startAuthCleanupWorker(1000, async () => { if (++calls === 1) throw new Error('fixture failure'); });
  await settle(); assert.equal(calls, 1);
  t.mock.timers.tick(1000); await settle(); assert.equal(calls, 2);
  await stop();
});

test('cleanup rejects unsafe retention and batch sizes before accessing SQL', async () => {
  const unreachable = {} as sql.ConnectionPool;
  for (const policy of [{ retentionDays: 0, batchSize: 10 }, { retentionDays: 7, batchSize: 1001 }, { retentionDays: 1.5, batchSize: 10 }]) {
    await assert.rejects(cleanupAuthBatch(unreachable, policy), /Auth cleanup requires/);
    await assert.rejects(previewAuthCleanup(unreachable, policy), /Auth cleanup requires/);
  }
});
