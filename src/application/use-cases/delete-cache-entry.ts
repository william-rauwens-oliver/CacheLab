import type { CacheRepository } from "../ports/cache-repository.js";

export class DeleteCacheEntry {
  public constructor(private readonly repository: CacheRepository) {}

  public execute(key: string) {
    return this.repository.delete(key);
  }
}
