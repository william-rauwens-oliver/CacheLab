import { createHttpApp } from "./adapters/http/create-http-app.js";
import { InMemoryCacheRepository } from "./adapters/storage/in-memory-cache-repository.js";
import type { RuntimeConfig } from "./config/runtime-config.js";
import { CustomHashTable } from "./engine/hash-table/custom-hash-table.js";

export function createCacheLab(config: RuntimeConfig) {
  const engine = new CustomHashTable(config.cacheMaxBytes);
  const repository = new InMemoryCacheRepository(engine);
  const app = createHttpApp(config);

  return { app, engine, repository };
}
