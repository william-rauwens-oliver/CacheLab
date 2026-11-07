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

export interface CacheStats {
  readonly entryCount: number;
  readonly usedBytes: number;
  readonly maxBytes: number;
  readonly bucketCount: number;
  readonly collisionCount: number;
  readonly resizeCount: number;
}
