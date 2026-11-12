import type { CacheRepository } from "../ports/cache-repository.js";
import type {
  CommandResult,
  CreateError
} from "../../domain/cache-types.js";

export class CreateCacheEntry {
  public constructor(private readonly repository: CacheRepository) {}

  public execute(key: string, value: string): CommandResult<CreateError> {
    return this.repository.create(key, value);
  }
}
