import { djb2 } from "../../dist/engine/hash-table/custom-hash-table.js";

export const INITIAL_BUCKET_COUNT = 16;

export function sizeOfEntry(key, value) {
  return Buffer.byteLength(key, "utf8") + Buffer.byteLength(value, "utf8");
}

export function findCollidingKeys(count) {
  const keys = [];
  let bucket;
  for (let index = 0; keys.length < count; index += 1) {
    const candidate = `key-${index}`;
    const candidateBucket = djb2(candidate) % INITIAL_BUCKET_COUNT;
    if (keys.length === 0) {
      bucket = candidateBucket;
      keys.push(candidate);
    } else if (candidateBucket === bucket) {
      keys.push(candidate);
    }
  }
  return keys;
}