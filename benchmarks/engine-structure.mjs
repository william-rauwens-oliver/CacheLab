// Engine structure benchmark (no HTTP): the two situations specific to a hand-written hash table.
//
// 1. Collisions. Keys that hash to the same bucket form a chain that get() must walk. We build tables
//    where one bucket holds a chain of about 1, 10, 100 then 1,000 keys, and time get() on the key at the
//    end of the chain (the worst case: it was inserted first, new keys go in front). The colliding keys are
//    found by trying keys until djb2(key) % 8192 matches. The table always has 8,192 buckets, and the
//    script checks that no resize happened, otherwise the keys would stop colliding.
//
// 2. Resize. When the load factor passes 0.75, create() doubles the bucket count and rebuilds every entry.
//    We take a table exactly one entry short of the limit, time the create() that triggers the resize with
//    a nanosecond clock, and compare it to a normal create(). This happens once per table, so batching
//    does not apply: the measure is repeated on fresh tables and we report the median, minimum and maximum.
//    The heap growth is read with process.memoryUsage() right after a forced garbage collection, so it
//    approximates the extra memory held by the resize (new buckets and entries while the old ones wait to
//    be collected). It is an approximation, not an exact peak.
//
// Usage: npm run bench:structure

import { Bench } from "tinybench";

import { djb2 } from "../dist/engine/hash-table/custom-hash-table.js";
import { VALUE, batched, buildTable, latencyRow } from "./engine-helpers.mjs";
import { saveResults } from "./save-results.mjs";

const CHAIN_LENGTHS = [1, 10, 100, 1000];
const COLLISION_BUCKET_COUNT = 8192;
const BACKGROUND_ENTRIES = 3500;
const RESIZE_FROM_BUCKET_COUNTS = [1 << 10, 1 << 14, 1 << 17, 1 << 20];
const RESIZE_WARMUP_RUNS = 3;
const RESIZE_MEASURED_RUNS = 20;
// After the first resize the smallest table (1,024 buckets) still has room for 767 creations before the
// next one, so the reference batch must stay below that.
const NORMAL_CREATES = 500;
const MAX_LOAD_FACTOR = 0.75;
const NANOSECONDS_PER_MICROSECOND = 1000;
const BYTES_PER_MEBIBYTE = 1024 * 1024;

// Keys whose djb2 hash falls in the same bucket of a table with `bucketCount` buckets.
function findCollidingKeys(count, bucketCount) {
  const keys = [];
  let target;
  for (let index = 0; keys.length < count; index += 1) {
    const candidate = `collide:${index}`;
    const bucket = djb2(candidate) % bucketCount;
    target ??= bucket;
    if (bucket === target) {
      keys.push(candidate);
    }
  }
  return keys;
}

// 3,500 ordinary entries make the table grow to 8,192 buckets; the colliding keys are added on top, and
// the total stays under the resize limit (0.75 * 8,192 = 6,144 entries).
function buildCollisionTable(collidingKeys) {
  const cache = buildTable(BACKGROUND_ENTRIES, 1024 * 1024);
  if (cache.getStats().bucketCount !== COLLISION_BUCKET_COUNT) {
    throw new Error("the background entries did not give a table of 8,192 buckets");
  }
  const resizesBefore = cache.getStats().resizeCount;
  for (const key of collidingKeys) {
    if (!cache.create(key, VALUE).ok) {
      throw new Error("a colliding key was not created");
    }
  }
  const stats = cache.getStats();
  if (stats.bucketCount !== COLLISION_BUCKET_COUNT || stats.resizeCount !== resizesBefore) {
    throw new Error("the table was resized while adding the colliding keys");
  }
  return cache;
}

async function measureCollisions() {
  const collidingKeys = findCollidingKeys(Math.max(...CHAIN_LENGTHS), COLLISION_BUCKET_COUNT);
  const bench = new Bench({ time: 1000, warmupTime: 300, retainSamples: true });

  for (const length of CHAIN_LENGTHS) {
    const keys = collidingKeys.slice(0, length);
    const cache = buildCollisionTable(keys);
    const endOfChain = keys[0];
    bench.add(
      `get at the end of a chain of ~${length}`,
      batched(bench, () => {
        if (!cache.get(endOfChain).ok) {
          throw new Error("a colliding key was not found");
        }
      })
    );
  }

  await bench.run();
  return bench.tasks.map((task, position) =>
    latencyRow(task, { "chain length": CHAIN_LENGTHS[position], buckets: COLLISION_BUCKET_COUNT })
  );
}

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

// One resize on a fresh table. Returns the duration of the create() that triggered it, the duration of a
// normal create() on the same table afterwards, and the heap growth caused by the resize.
function resizeOnce(bucketCount) {
  const entriesBefore = bucketCount * MAX_LOAD_FACTOR;
  const cache = buildTable(entriesBefore, (entriesBefore + NORMAL_CREATES + 1) * 64);
  const before = cache.getStats();
  if (before.bucketCount !== bucketCount || before.entryCount !== entriesBefore) {
    throw new Error(`expected ${bucketCount} buckets and ${entriesBefore} entries before the resize`);
  }

  globalThis.gc();
  const heapBefore = process.memoryUsage().heapUsed;
  const resizeStart = process.hrtime.bigint();
  const triggered = cache.create("resize:trigger", VALUE);
  const resizeNanoseconds = Number(process.hrtime.bigint() - resizeStart);
  const heapGrowth = process.memoryUsage().heapUsed - heapBefore;

  const after = cache.getStats();
  if (!triggered.ok || after.bucketCount !== bucketCount * 2 || after.resizeCount !== before.resizeCount + 1) {
    throw new Error("the create did not trigger exactly one resize");
  }

  const normalStart = process.hrtime.bigint();
  for (let index = 0; index < NORMAL_CREATES; index += 1) {
    if (!cache.create(`resize:normal:${index}`, VALUE).ok) {
      throw new Error("a normal create failed");
    }
  }
  const normalNanoseconds = Number(process.hrtime.bigint() - normalStart) / NORMAL_CREATES;
  if (cache.getStats().resizeCount !== after.resizeCount) {
    throw new Error("a normal create triggered a resize");
  }

  return { resizeNanoseconds, normalNanoseconds, heapGrowth };
}

function measureResizes() {
  if (typeof globalThis.gc !== "function") {
    throw new Error("garbage collection is not exposed: run this benchmark with npm run bench:structure");
  }

  return RESIZE_FROM_BUCKET_COUNTS.map((bucketCount) => {
    for (let run = 0; run < RESIZE_WARMUP_RUNS; run += 1) {
      resizeOnce(bucketCount);
    }
    const runs = Array.from({ length: RESIZE_MEASURED_RUNS }, () => resizeOnce(bucketCount));
    const resizes = runs.map((run) => run.resizeNanoseconds);
    const medianResize = median(resizes);
    const medianNormal = median(runs.map((run) => run.normalNanoseconds));
    return {
      scenario: "create that triggers a resize",
      "buckets before": bucketCount,
      "entries before": bucketCount * MAX_LOAD_FACTOR,
      runs: RESIZE_MEASURED_RUNS,
      "resize median (µs)": Math.round(medianResize / NANOSECONDS_PER_MICROSECOND),
      "resize min (µs)": Math.round(Math.min(...resizes) / NANOSECONDS_PER_MICROSECOND),
      "resize max (µs)": Math.round(Math.max(...resizes) / NANOSECONDS_PER_MICROSECOND),
      "normal create (ns)": Math.round(medianNormal),
      "resize / normal": Math.round(medianResize / medianNormal),
      "heap growth (MiB)": Math.round((median(runs.map((run) => run.heapGrowth)) / BYTES_PER_MEBIBYTE) * 10) / 10
    };
  });
}

console.log("Measuring collisions...");
const collisions = await measureCollisions();
console.log("Measuring resizes...");
const resizes = measureResizes();
saveResults(
  "structure",
  {
    collisionBucketCount: COLLISION_BUCKET_COUNT,
    chainLengths: CHAIN_LENGTHS,
    backgroundEntries: BACKGROUND_ENTRIES,
    resizeFromBucketCounts: RESIZE_FROM_BUCKET_COUNTS,
    resizeWarmupRuns: RESIZE_WARMUP_RUNS,
    resizeMeasuredRuns: RESIZE_MEASURED_RUNS,
    valueBytes: VALUE.length
  },
  { "Collisions: get at the end of a chain": collisions, "Resize: cost of the create that triggers it": resizes }
);