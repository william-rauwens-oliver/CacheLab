// Shared by the engine benchmarks (engine.mjs and engine-structure.mjs): table preparation, key
// scattering, exact percentiles and the batching that lets Tinybench time operations shorter than the
// timer resolution. Preparation is never measured.

import { CustomHashTable } from "../dist/engine/hash-table/custom-hash-table.js";

export const VALUE = "x".repeat(16);
export const BATCH_SIZE = 1000;

const SCATTER_STEP = 7919;
const NANOSECONDS_PER_MILLISECOND = 1e6;

// A table holding key:0 ... key:(volume - 1). The logical capacity leaves room for the entries to come.
export function buildTable(volume, capacityBytes = volume * 64) {
  const cache = new CustomHashTable(capacityBytes);
  for (let index = 0; index < volume; index += 1) {
    const result = cache.create(`key:${index}`, VALUE);
    if (!result.ok) {
      throw new Error(`preparation failed at ${index}: ${result.error}`);
    }
  }
  return cache;
}

// Returns a function giving, at each call, the next index of a scattered walk over 0 ... volume - 1.
// The step is prime, so every index is visited once per cycle, in an order without a pattern.
export function scatter(volume) {
  let cursor = 0;
  return () => {
    cursor = (cursor + SCATTER_STEP) % volume;
    return cursor;
  };
}

export function exactPercentile(sortedSamples, percentile) {
  return sortedSamples[Math.ceil(percentile * sortedSamples.length) - 1];
}

export function toNanoseconds(milliseconds) {
  return Math.round(milliseconds * NANOSECONDS_PER_MILLISECOND);
}

// A Tinybench task function that times BATCH_SIZE calls of `operation` and reports their mean as one sample.
export function batched(bench, operation) {
  return () => {
    const start = bench.now();
    for (let call = 0; call < BATCH_SIZE; call += 1) {
      operation();
    }
    const elapsed = bench.now() - start;
    return { overriddenDuration: elapsed / BATCH_SIZE, overriddenIterationCost: elapsed };
  };
}

// One result row for a finished Tinybench task. `leadingColumns` are inserted after the scenario name.
export function latencyRow(task, leadingColumns) {
  const { latency, throughput } = task.result;
  return {
    scenario: task.name,
    ...leadingColumns,
    "ops/s": Math.round(throughput.mean),
    "mean (ns)": toNanoseconds(latency.mean),
    "p50 (ns)": toNanoseconds(latency.p50),
    "p95 (ns)": toNanoseconds(exactPercentile(latency.samples, 0.95)),
    "p99 (ns)": toNanoseconds(latency.p99),
    "max (ns)": toNanoseconds(latency.max),
    samples: latency.samplesCount
  };
}
