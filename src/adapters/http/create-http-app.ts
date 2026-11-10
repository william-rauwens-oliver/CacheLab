import cors from "cors";
import express from "express";
import helmet from "helmet";

import type { CreateCacheEntry } from "../../application/use-cases/create-cache-entry.js";
import type { GetCacheEntry } from "../../application/use-cases/get-cache-entry.js";
import type { RuntimeConfig } from "../../config/runtime-config.js";
import { createErrorMiddleware } from "./error-middleware.js";
import { sendError } from "./error-response.js";
import { silentHttpLogger, type HttpLogger } from "./http-logger.js";
import { mapCacheError } from "./map-cache-error.js";
import { validateCreateBody, validateKeyParam } from "./validation.js";

export interface HttpDependencies {
  readonly createEntry: CreateCacheEntry;
  readonly getEntry: GetCacheEntry;
}

export interface CreateHttpAppOptions {
  readonly logger?: HttpLogger;
}

export function createHttpApp(
  config: RuntimeConfig,
  dependencies: HttpDependencies,
  options: CreateHttpAppOptions = {}
) {
  const logger = options.logger ?? silentHttpLogger;
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

  app.post("/api/v1/keys", (request, response) => {
    const validation = validateCreateBody(request.body);
    if (!validation.ok) {
      return sendError(response, 400, "VALIDATION_ERROR", validation.message);
    }

    const result = dependencies.createEntry.execute(
      validation.value.key,
      validation.value.value
    );
    if (!result.ok) {
      const mapped = mapCacheError(result.error);
      return sendError(response, mapped.status, mapped.code, mapped.message);
    }
    return response.status(201).send();
  });

  app.get("/api/v1/keys/:key", (request, response) => {
    const validation = validateKeyParam(request.params.key);
    if (!validation.ok) {
      return sendError(response, 400, "VALIDATION_ERROR", validation.message);
    }

    const result = dependencies.getEntry.execute(validation.value);
    if (!result.ok) {
      const mapped = mapCacheError(result.error);
      return sendError(response, mapped.status, mapped.code, mapped.message);
    }
    return response.status(200).json({ key: validation.value, value: result.value });
  });

  app.use((_request, response) => {
    sendError(response, 404, "ROUTE_NOT_FOUND", "Route not found");
  });

  app.use(createErrorMiddleware(logger));

  return app;
}
