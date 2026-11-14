// Engine benchmark (no HTTP): latency and throughput of CustomHashTable operations with Tinybench.
// Operations so far: get() on an existing and on an absent key, update() of an existing key with a value
// of the same size, delete() of an existing key, create() of a new key, on a table of 10,000 then
// 1,000,000 entries. delete() and create() change the table: each batch does 1,000 of them inside the
// timed section, then undoes them outside of it, so the table has the same content at the start of
// every batch. 1,000 creations never trigger a resize at these volumes (resize is a separate scenario).
// Each Tinybench sample is the mean latency of a batch of calls: a single get() lasts a few tens of
// nanoseconds, which is below the timer resolution, so timing one call at a time would give zeros.
// Percentiles are therefore percentiles of batch means, not of single operations.
// Usage: npm run bench:engine

import { Bench } from "tinybench";

import { CustomHashTable } from "../dist/engine/hash-table/custom-hash-table.js";

const VOLUMES = [10_000, 1_000_000];
const VALUE = "x".repeat(16);
const UPDATED_VALUE = "y".repeat(16);
const SCATTER_STEP = 7919;
const BATCH_SIZE = 1000;
const NANOSECONDS_PER_MILLISECOND = 1e6;

function buildTable(volume) {
  const cache = new CustomHashTable(volume * 64);
  for (let index = 0; index < volume; index += 1) {
    const result = cache.create(`key:${index}`, VALUE);
    if (!result.ok) {
      throw new Error(`preparation failed at ${index}: ${result.error}`);
    }
  }
  return cache;
}

function scatter(volume) {
  let cursor = 0;
  return () => {
    cursor = (cursor + SCATTER_STEP) % volume;
    return cursor;
  };
}

function exactPercentile(sortedSamples, percentile) {
  return sortedSamples[Math.ceil(percentile * sortedSamples.length) - 1];
}

function toNanoseconds(milliseconds) {
  return Math.round(milliseconds * NANOSECONDS_PER_MILLISECOND);
}

async function measureVolume(volume) {
  const cache = buildTable(volume);
  const stats = cache.getStats();
  if (stats.entryCount !== volume) {
    throw new Error(`expected ${volume} entries, found ${stats.entryCount}`);
  }

  const existingKeys = Array.from({ length: volume }, (_, index) => `key:${index}`);
  const absentKeys = Array.from({ length: volume }, (_, index) => `absent:${index}`);
  const nextExisting = scatter(volume);
  const nextAbsent = scatter(volume);
  const nextUpdated = scatter(volume);
  const nextDeleted = scatter(volume);
  const nextCreated = scatter(volume);

  const bench = new Bench({
    time: 1000,
    warmupTime: 300,
    retainSamples: true
  });

  const batched = (operation) => () => {
    const start = bench.now();
    for (let call = 0; call < BATCH_SIZE; call += 1) {
      operation();
    }
    const elapsed = bench.now() - start;
    return { overriddenDuration: elapsed / BATCH_SIZE, overriddenIterationCost: elapsed };
  };

  bench.add(
    "get existing key",
    batched(() => {
      if (!cache.get(existingKeys[nextExisting()]).ok) {
        throw new Error("an existing key was not found");
      }
    })
  );
  bench.add(
    "get absent key",
    batched(() => {
      if (cache.get(absentKeys[nextAbsent()]).ok) {
        throw new Error("an absent key was found");
      }
    })
  );
  bench.add(
    "update existing key (same size)",
    batched(() => {
      if (!cache.update(existingKeys[nextUpdated()], UPDATED_VALUE).ok) {
        throw new Error("an existing key was not updated");
      }
    })
  );

  bench.add("delete existing key", () => {
    const callStart = bench.now();
    const keys = Array.from({ length: BATCH_SIZE }, () => existingKeys[nextDeleted()]);

    const deleteStart = bench.now();
    for (const key of keys) {
      if (!cache.delete(key).ok) {
        throw new Error("an existing key was not deleted");
      }
    }
    const deleteElapsed = bench.now() - deleteStart;

    for (const key of keys) {
      if (!cache.create(key, VALUE).ok) {
        throw new Error("a deleted key was not recreated");
      }
    }
    return {
      overriddenDuration: deleteElapsed / BATCH_SIZE,
      overriddenIterationCost: bench.now() - callStart
    };
  });

  bench.add("create new key", () => {
    const callStart = bench.now();
    const keys = Array.from({ length: BATCH_SIZE }, () => absentKeys[nextCreated()]);

    const createStart = bench.now();
    for (const key of keys) {
      if (!cache.create(key, VALUE).ok) {
        throw new Error("a new key was not created");
      }
    }
    const createElapsed = bench.now() - createStart;

    for (const key of keys) {
      if (!cache.delete(key).ok) {
        throw new Error("a created key was not deleted");
      }
    }
    return {
      overriddenDuration: createElapsed / BATCH_SIZE,
      overriddenIterationCost: bench.now() - callStart
    };
  });

  await bench.run();

  const finalStats = cache.getStats();
  if (finalStats.entryCount !== volume || finalStats.usedBytes !== stats.usedBytes) {
    throw new Error("the measured operations changed the table size");
  }

  return bench.tasks.map((task) => {
    const { latency, throughput } = task.result;
    return {
      scenario: task.name,
      volume,
      "ops/s": Math.round(throughput.mean),
      "mean (ns)": toNanoseconds(latency.mean),
      "p50 (ns)": toNanoseconds(latency.p50),
      "p95 (ns)": toNanoseconds(exactPercentile(latency.samples, 0.95)),
      "p99 (ns)": toNanoseconds(latency.p99),
      "max (ns)": toNanoseconds(latency.max),
      samples: latency.samplesCount
    };
  });
}

const rows = [];
for (const volume of VOLUMES) {
  console.log(`Measuring ${volume.toLocaleString("en-US")} entries...`);
  rows.push(...(await measureVolume(volume)));
}
console.table(rows);