import type {
  CacheStats,
  CommandResult,
  CreateError,
  DeleteError,
  GetError,
  Result,
  UpdateError
} from "../../domain/cache-types.js";

export interface CacheRepository {
  create(key: string, value: string): CommandResult<CreateError>;
  get(key: string): Result<string, GetError>;
  update(key: string, value: string): CommandResult<UpdateError>;
  delete(key: string): CommandResult<DeleteError>;
  getStats(): CacheStats;
}
