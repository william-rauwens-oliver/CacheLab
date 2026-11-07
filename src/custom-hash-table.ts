export type CacheError =
  | "KEY_ALREADY_EXISTS"
  | "KEY_NOT_FOUND"
  | "CAPACITY_EXCEEDED";

export type CommandResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: CacheError };

export type ReadResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: "KEY_NOT_FOUND" };

interface Entry {
  readonly key: string;
  value: string;
  next: Entry | undefined;
}

export interface CacheStats {
  readonly entryCount: number;
  readonly usedBytes: number;
  readonly maxBytes: number;
  readonly bucketCount: number;
  readonly collisionCount: number;
  readonly resizeCount: number;
}

const INITIAL_BUCKET_COUNT = 16;
const MAX_LOAD_FACTOR = 0.75;
const textEncoder = new TextEncoder();

export function djb2(key: string): number {
  let hash = 5381;
  for (let index = 0; index < key.length; index += 1) {
    hash = (Math.imul(hash, 33) ^ key.charCodeAt(index)) >>> 0;
  }
  return hash >>> 0;
}

export class CustomHashTable {
  private buckets: Array<Entry | undefined> = new Array<Entry | undefined>(
    INITIAL_BUCKET_COUNT
  );
  private entryCount = 0;
  private usedBytes = 0;
  private collisionCount = 0;
  private resizeCount = 0;

  public constructor(private readonly maxBytes: number) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      throw new RangeError("maxBytes must be a positive safe integer");
    }
  }

  public create(key: string, value: string): CommandResult {
    if (this.find(key) !== undefined) {
      return { ok: false, error: "KEY_ALREADY_EXISTS" };
    }

    const addedBytes = this.sizeOf(key) + this.sizeOf(value);
    if (this.usedBytes + addedBytes > this.maxBytes) {
      return { ok: false, error: "CAPACITY_EXCEEDED" };
    }

    if ((this.entryCount + 1) / this.buckets.length > MAX_LOAD_FACTOR) {
      this.resize();
    }

    const index = this.indexFor(key, this.buckets.length);
    const head = this.buckets[index];
    if (head !== undefined) {
      this.collisionCount += 1;
    }
    this.buckets[index] = { key, value, next: head };
    this.entryCount += 1;
    this.usedBytes += addedBytes;
    return { ok: true };
  }

  public get(key: string): ReadResult {
    const entry = this.find(key);
    return entry === undefined
      ? { ok: false, error: "KEY_NOT_FOUND" }
      : { ok: true, value: entry.value };
  }

  public update(key: string, value: string): CommandResult {
    const entry = this.find(key);
    if (entry === undefined) {
      return { ok: false, error: "KEY_NOT_FOUND" };
    }

    const futureBytes = this.usedBytes - this.sizeOf(entry.value) + this.sizeOf(value);
    if (futureBytes > this.maxBytes) {
      return { ok: false, error: "CAPACITY_EXCEEDED" };
    }

    entry.value = value;
    this.usedBytes = futureBytes;
    return { ok: true };
  }

  public delete(key: string): CommandResult {
    const index = this.indexFor(key, this.buckets.length);
    let current = this.buckets[index];
    let previous: Entry | undefined;

    while (current !== undefined && current.key !== key) {
      previous = current;
      current = current.next;
    }
    if (current === undefined) {
      return { ok: false, error: "KEY_NOT_FOUND" };
    }

    if (previous === undefined) {
      this.buckets[index] = current.next;
    } else {
      previous.next = current.next;
    }
    this.entryCount -= 1;
    this.usedBytes -= this.sizeOf(current.key) + this.sizeOf(current.value);
    return { ok: true };
  }

  public getStats(): CacheStats {
    return {
      entryCount: this.entryCount,
      usedBytes: this.usedBytes,
      maxBytes: this.maxBytes,
      bucketCount: this.buckets.length,
      collisionCount: this.collisionCount,
      resizeCount: this.resizeCount
    };
  }

  private find(key: string): Entry | undefined {
    let entry = this.buckets[this.indexFor(key, this.buckets.length)];
    while (entry !== undefined) {
      if (entry.key === key) {
        return entry;
      }
      entry = entry.next;
    }
    return undefined;
  }

  private resize(): void {
    const resized = new Array<Entry | undefined>(this.buckets.length * 2);
    for (const bucket of this.buckets) {
      let entry = bucket;
      while (entry !== undefined) {
        const index = this.indexFor(entry.key, resized.length);
        resized[index] = { key: entry.key, value: entry.value, next: resized[index] };
        entry = entry.next;
      }
    }
    this.buckets = resized;
    this.resizeCount += 1;
  }

  private indexFor(key: string, bucketCount: number): number {
    return djb2(key) % bucketCount;
  }

  private sizeOf(value: string): number {
    return textEncoder.encode(value).byteLength;
  }
}
