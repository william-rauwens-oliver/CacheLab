import type { CacheError } from "../../domain/cache-types.js";

export interface MappedCacheError {
  readonly status: number;
  readonly code: CacheError;
  readonly message: string;
}

const MAPPING: Readonly<Record<CacheError, MappedCacheError>> = {
  KEY_ALREADY_EXISTS: {
    status: 409,
    code: "KEY_ALREADY_EXISTS",
    message: "Key already exists"
  },
  KEY_NOT_FOUND: {
    status: 404,
    code: "KEY_NOT_FOUND",
    message: "Key not found"
  },
  CAPACITY_EXCEEDED: {
    status: 507,
    code: "CAPACITY_EXCEEDED",
    message: "Cache capacity exceeded"
  }
};

export function mapCacheError(error: CacheError): MappedCacheError {
  return MAPPING[error];
}
