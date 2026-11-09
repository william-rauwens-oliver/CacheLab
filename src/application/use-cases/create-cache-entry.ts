import type { CacheRepository } from "../ports/cache-repository.js";

export class CreateCacheEntry {
  public constructor(private readonly repository: CacheRepository) {}

  public execute(key: string, value: string) {
    return this.repository.create(key, value);
  }
}
