import type { CacheRepository } from "../../application/ports/cache-repository.js";
import type {
  CacheStats,
  CommandResult,
  CreateError,
  DeleteError,
  GetError,
  Result,
  UpdateError
} from "../../domain/cache-types.js";
import type { CustomHashTable } from "../../engine/hash-table/custom-hash-table.js";

export class InMemoryCacheRepository implements CacheRepository {
  public constructor(private readonly engine: CustomHashTable) {}

  public create(key: string, value: string): CommandResult<CreateError> {
    return this.engine.create(key, value);
  }

  public get(key: string): Result<string, GetError> {
    return this.engine.get(key);
  }

  public update(key: string, value: string): CommandResult<UpdateError> {
    return this.engine.update(key, value);
  }

  public delete(key: string): CommandResult<DeleteError> {
    return this.engine.delete(key);
  }

  public getStats(): CacheStats {
    return this.engine.getStats();
  }
}
