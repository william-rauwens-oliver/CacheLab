export type CreateError = "KEY_ALREADY_EXISTS" | "CAPACITY_EXCEEDED";
export type GetError = "KEY_NOT_FOUND";
export type UpdateError = "KEY_NOT_FOUND" | "CAPACITY_EXCEEDED";
export type DeleteError = "KEY_NOT_FOUND";

export type CacheError = CreateError | GetError | UpdateError | DeleteError;

export type Result<T, E extends CacheError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type CommandResult<E extends CacheError> =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: E };

export interface CacheStats {
  readonly entryCount: number;
  readonly usedBytes: number;
  readonly maxBytes: number;
  readonly bucketCount: number;
  readonly collisionCount: number;
  readonly resizeCount: number;
}
