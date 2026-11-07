import type {
  CacheStats,
  CommandResult,
  ReadResult
} from "../../domain/cache-types.js";

export interface CacheRepository {
  create(key: string, value: string): CommandResult;
  get(key: string): ReadResult;
  update(key: string, value: string): CommandResult;
  delete(key: string): CommandResult;
  getStats(): CacheStats;
}
