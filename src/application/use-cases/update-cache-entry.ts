import type { CacheRepository } from "../ports/cache-repository.js";
import type {
  CommandResult,
  UpdateError
} from "../../domain/cache-types.js";

export class UpdateCacheEntry {
  public constructor(private readonly repository: CacheRepository) {}

  public execute(key: string, value: string): CommandResult<UpdateError> {
    return this.repository.update(key, value);
  }
}
