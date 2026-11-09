import cors from "cors";
import express from "express";
import helmet from "helmet";

import type { GetCacheEntry } from "../../application/use-cases/get-cache-entry.js";
import type { RuntimeConfig } from "../../config/runtime-config.js";

interface HttpDependencies {
  readonly getEntry: GetCacheEntry;
}

export function createHttpApp(
  config: RuntimeConfig,
  dependencies: HttpDependencies
) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.length === 0 ? false : [...config.corsOrigins]
    })
  );
  app.use(express.json({ limit: config.httpBodyLimit, strict: true }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.get("/api/v1/keys/:key", (request, response) => {
    const result = dependencies.getEntry.execute(request.params.key);
    if (!result.ok) {
      response.status(404).json({
        error: { code: "KEY_NOT_FOUND", message: "Key not found" }
      });
      return;
    }

    response.status(200).json({ key: request.params.key, value: result.value });
  });

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "ROUTE_NOT_FOUND", message: "Route not found" }
    });
  });

  return app;
}
