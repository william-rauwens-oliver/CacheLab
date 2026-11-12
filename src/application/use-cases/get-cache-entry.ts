import type { CacheRepository } from "../ports/cache-repository.js";
import type { GetError, Result } from "../../domain/cache-types.js";

export class GetCacheEntry {
  public constructor(private readonly repository: CacheRepository) {}

  public execute(key: string): Result<string, GetError> {
    return this.repository.get(key);
  }
}
