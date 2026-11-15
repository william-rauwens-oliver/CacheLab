// Unit: RM-012, an entry stays readable and unchanged after a very long delay, with or without
// reads, no timer is scheduled by engine operations, only an explicit delete removes an entry.

import assert from "node:assert/strict";
import { test } from "node:test";

import { CustomHashTable } from "../../dist/engine/hash-table/custom-hash-table.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

test("RM-012 : une entrée reste lisible, inchangée, après un très long délai", (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: 0 });
  const cache = new CustomHashTable(1024);
  cache.create("user:1", "Alice");
  cache.create("user:2", "Bob");
  const before = cache.getStats();

  for (const elapsed of [HOUR, DAY, 30 * DAY, 365 * DAY, 10 * 365 * DAY]) {
    context.mock.timers.tick(elapsed);

    assert.deepEqual(cache.get("user:1"), { ok: true, value: "Alice" });
    assert.deepEqual(cache.get("user:2"), { ok: true, value: "Bob" });
    assert.deepEqual(cache.getStats(), before);
  }
});

test("RM-012 : une entrée jamais relue reste disponible, comme une entrée consultée", (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: 0 });
  const cache = new CustomHashTable(1024);
  cache.create("never-read", "value");

  context.mock.timers.tick(365 * DAY);

  assert.deepEqual(cache.get("never-read"), { ok: true, value: "value" });
});

test("RM-012 : les opérations du moteur ne programment aucun minuteur", (context) => {
  const setTimeoutSpy = context.mock.method(globalThis, "setTimeout");
  const setIntervalSpy = context.mock.method(globalThis, "setInterval");
  const cache = new CustomHashTable(1024);

  cache.create("a", "1");
  cache.update("a", "2");
  cache.get("a");
  cache.create("b", "3");
  cache.delete("b");
  for (let index = 0; index < 20; index += 1) {
    cache.create(`key-${index}`, "v");
  }

  assert.equal(setTimeoutSpy.mock.callCount(), 0);
  assert.equal(setIntervalSpy.mock.callCount(), 0);
  assert.equal(cache.getStats().resizeCount >= 1, true);
});

test("RM-012 : seule une suppression explicite retire une entrée", (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: 0 });
  const cache = new CustomHashTable(1024);
  cache.create("kept", "1");
  cache.create("removed", "2");

  context.mock.timers.tick(365 * DAY);
  assert.deepEqual(cache.delete("removed"), { ok: true });
  context.mock.timers.tick(365 * DAY);

  assert.deepEqual(cache.get("removed"), { ok: false, error: "KEY_NOT_FOUND" });
  assert.deepEqual(cache.get("kept"), { ok: true, value: "1" });
});