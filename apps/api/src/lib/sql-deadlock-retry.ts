import { setTimeout } from "node:timers/promises";

// Only use around a transaction that is rolled back on failure. SQL Server
// error 1205 means the victim transaction was aborted; other errors are unsafe
// to retry because a write may already have committed.
export async function retrySqlDeadlock<T>(transaction: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await transaction(); }
    catch (error) {
      const sqlError = error as { code?: unknown; number?: unknown } | null;
      if (sqlError?.code !== "EREQUEST" || sqlError.number !== 1205 || attempt >= 2) throw error;
      await setTimeout(25 * (attempt + 1));
    }
  }
}
