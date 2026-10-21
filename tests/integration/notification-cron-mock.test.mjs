import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Import the actual cleanup function without starting Workers or connecting to Neon.
// Only a type import is used by notifications.ts, so transpiling to JS is safe here.
const source = readFileSync(new URL("../../backend/src/notifications.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { cleanupExpiredNotifications } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);

function mockDatabase(batchSizes) {
  const statements = [];
  let calls = 0;
  const sql = async (strings, ...params) => {
    const statement = String.raw({ raw: strings.raw }, ...params.map(() => "?"));
    statements.push(statement);
    assert.match(statement, /read_at < now\(\) - INTERVAL '30 days'/);
    assert.match(statement, /FOR UPDATE SKIP LOCKED/);
    assert.match(statement, /DELETE FROM public\.notifications/);
    assert.match(statement, /LIMIT \?/);
    const count = batchSizes[calls++] ?? 0;
    return Array.from({ length: count }, (_, i) => ({ id: `fake-${calls}-${i}` }));
  };
  return { sql, statements };
}

test("cron cleanup: zero expired rows performs one bounded query", async () => {
  const db = mockDatabase([0]);
  assert.equal(await cleanupExpiredNotifications(db.sql), 0);
  assert.equal(db.statements.length, 1);
});

test("cron cleanup: deletes in batches and stops after a short batch", async () => {
  const db = mockDatabase([500, 500, 12]);
  assert.equal(await cleanupExpiredNotifications(db.sql), 1012);
  assert.equal(db.statements.length, 3);
});

test("cron cleanup: caps work at ten batches per run", async () => {
  const db = mockDatabase(Array(15).fill(500));
  assert.equal(await cleanupExpiredNotifications(db.sql), 5000);
  assert.equal(db.statements.length, 10);
});

test("cron cleanup: reports database failures instead of swallowing them", async () => {
  const sql = async () => { throw new Error("test-db-error"); };
  await assert.rejects(cleanupExpiredNotifications(sql), /test-db-error/);
});
