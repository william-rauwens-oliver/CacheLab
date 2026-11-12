import type { CacheRepository } from "../ports/cache-repository.js";
import type {
  CommandResult,
  DeleteError
} from "../../domain/cache-types.js";

export class DeleteCacheEntry {
  public constructor(private readonly repository: CacheRepository) {}

  public execute(key: string): CommandResult<DeleteError> {
    return this.repository.delete(key);
  }
}
