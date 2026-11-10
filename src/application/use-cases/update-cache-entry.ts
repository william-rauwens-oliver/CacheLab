import type { CacheRepository } from "../ports/cache-repository.js";

export class UpdateCacheEntry {
  public constructor(private readonly repository: CacheRepository) {}

  public execute(key: string, value: string) {
    return this.repository.update(key, value);
  }
}
