// Unit: the engine is compared with a simple reference model (a Map, used only in the test)
// over a deterministic sequence of 3000 mixed operations, refusals and resizes included.

import assert from "node:assert/strict";
import { test } from "node:test";

import { CustomHashTable } from "../../dist/engine/hash-table/custom-hash-table.js";
import { sizeOfEntry } from "../helpers/storage-helpers.mjs";

const CACHE_MAX_BYTES = 300;
const STEPS = 3000;

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const KEYS = [
  ...Array.from({ length: 40 }, (_, index) => `key-${index}`),
  "é",
  "clé",
  "emoji-\u{1F600}"
];
const VALUES = ["", "a", "bb", "hello", "é", "€uro", "\u{1F600}", "x".repeat(20), "y".repeat(60)];
const OPERATIONS = ["create", "update", "delete", "get"];

test("the engine matches a reference model across 3000 mixed operations, refusals included", () => {
  const random = createRandom(42);
  const pick = (items) => items[Math.floor(random() * items.length)];

  const cache = new CustomHashTable(CACHE_MAX_BYTES);
  const model = new Map();
  let usedBytes = 0;
  const outcomes = new Map();

  for (let step = 0; step < STEPS; step += 1) {
    const operation = pick(OPERATIONS);
    const key = pick(KEYS);
    const value = pick(VALUES);
    let expected;
    let actual;

    if (operation === "create") {
      actual = cache.create(key, value);
      if (model.has(key)) {
        expected = { ok: false, error: "KEY_ALREADY_EXISTS" };
      } else if (usedBytes + sizeOfEntry(key, value) > CACHE_MAX_BYTES) {
        expected = { ok: false, error: "CAPACITY_EXCEEDED" };
      } else {
        model.set(key, value);
        usedBytes += sizeOfEntry(key, value);
        expected = { ok: true };
      }
    } else if (operation === "update") {
      actual = cache.update(key, value);
      if (!model.has(key)) {
        expected = { ok: false, error: "KEY_NOT_FOUND" };
      } else {
        const future =
          usedBytes - Buffer.byteLength(model.get(key), "utf8") + Buffer.byteLength(value, "utf8");
        if (future > CACHE_MAX_BYTES) {
          expected = { ok: false, error: "CAPACITY_EXCEEDED" };
        } else {
          model.set(key, value);
          usedBytes = future;
          expected = { ok: true };
        }
      }
    } else if (operation === "delete") {
      actual = cache.delete(key);
      if (!model.has(key)) {
        expected = { ok: false, error: "KEY_NOT_FOUND" };
      } else {
        usedBytes -= sizeOfEntry(key, model.get(key));
        model.delete(key);
        expected = { ok: true };
      }
    } else {
      actual = cache.get(key);
      expected = model.has(key)
        ? { ok: true, value: model.get(key) }
        : { ok: false, error: "KEY_NOT_FOUND" };
    }

    assert.deepEqual(actual, expected, `step ${step}: ${operation} ${JSON.stringify(key)}`);
    const stats = cache.getStats();
    assert.equal(stats.entryCount, model.size, `step ${step}: entryCount`);
    assert.equal(stats.usedBytes, usedBytes, `step ${step}: usedBytes`);
    assert.ok(stats.usedBytes <= CACHE_MAX_BYTES, `step ${step}: capacity respected`);

    const outcome = `${operation}:${actual.ok ? "ok" : actual.error}`;
    outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
  }

  for (const key of KEYS) {
    assert.deepEqual(
      cache.get(key),
      model.has(key)
        ? { ok: true, value: model.get(key) }
        : { ok: false, error: "KEY_NOT_FOUND" }
    );
  }

  assert.ok(outcomes.get("create:KEY_ALREADY_EXISTS") > 0, "no duplicate refusal exercised");
  assert.ok(outcomes.get("create:CAPACITY_EXCEEDED") > 0, "no create capacity refusal exercised");
  assert.ok(outcomes.get("update:CAPACITY_EXCEEDED") > 0, "no update capacity refusal exercised");
  assert.ok(outcomes.get("update:KEY_NOT_FOUND") > 0, "no absent update exercised");
  assert.ok(outcomes.get("delete:KEY_NOT_FOUND") > 0, "no absent delete exercised");
  assert.ok(cache.getStats().resizeCount >= 1, "no resize exercised");
});