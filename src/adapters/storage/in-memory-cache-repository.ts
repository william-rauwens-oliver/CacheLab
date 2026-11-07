import type { CacheRepository } from "../../application/ports/cache-repository.js";
import type { CustomHashTable } from "../../engine/hash-table/custom-hash-table.js";

export class InMemoryCacheRepository implements CacheRepository {
  public constructor(private readonly engine: CustomHashTable) {}

  public create(key: string, value: string) {
    return this.engine.create(key, value);
  }

  public get(key: string) {
    return this.engine.get(key);
  }

  public update(key: string, value: string) {
    return this.engine.update(key, value);
  }

  public delete(key: string) {
    return this.engine.delete(key);
  }

  public getStats() {
    return this.engine.getStats();
  }
}
