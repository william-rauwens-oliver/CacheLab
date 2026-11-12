import cors from "cors";
import express, { type ErrorRequestHandler, type Response } from "express";
import helmet from "helmet";

import type { CreateCacheEntry } from "../../application/use-cases/create-cache-entry.js";
import type { DeleteCacheEntry } from "../../application/use-cases/delete-cache-entry.js";
import type { GetCacheEntry } from "../../application/use-cases/get-cache-entry.js";
import type { UpdateCacheEntry } from "../../application/use-cases/update-cache-entry.js";
import type { RuntimeConfig } from "../../config/runtime-config.js";
import {
  validateCreateBody,
  validateRouteKey,
  validateUpdateBody
} from "./validation.js";
import { registerOpenApiDocumentation } from "./openapi.js";

export interface HttpDependencies {
  readonly createEntry: CreateCacheEntry;
  readonly deleteEntry: DeleteCacheEntry;
  readonly getEntry: GetCacheEntry;
  readonly updateEntry: UpdateCacheEntry;
}

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string
) {
  return response.status(status).json({ error: { code, message } });
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

  if (config.docsEnabled) {
    registerOpenApiDocumentation(app);
  }

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.get("/", (_request, response) => {
    if (config.docsEnabled) {
      return response.redirect(302, "/docs/");
    }

    return response.status(200).json({
      name: "CacheLab",
      status: "ok",
      apiBasePath: "/api/v1"
    });
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
    if (!result.ok && result.error === "KEY_ALREADY_EXISTS") {
      return sendError(response, 409, result.error, "Key already exists");
    }
    if (!result.ok && result.error === "CAPACITY_EXCEEDED") {
      return sendError(response, 507, result.error, "Cache capacity exceeded");
    }
    return response.status(201).send();
  });

  app.get("/api/v1/keys/:key", (request, response) => {
    const validation = validateRouteKey(request.params.key);
    if (!validation.ok) {
      return sendError(response, 400, "VALIDATION_ERROR", validation.message);
    }

    const result = dependencies.getEntry.execute(validation.value);
    if (!result.ok) {
      return sendError(response, 404, result.error, "Key not found");
    }
    return response.status(200).json({ key: validation.value, value: result.value });
  });

  app.put("/api/v1/keys/:key", (request, response) => {
    const keyValidation = validateRouteKey(request.params.key);
    if (!keyValidation.ok) {
      return sendError(
        response,
        400,
        "VALIDATION_ERROR",
        keyValidation.message
      );
    }

    const bodyValidation = validateUpdateBody(request.body);
    if (!bodyValidation.ok) {
      return sendError(
        response,
        400,
        "VALIDATION_ERROR",
        bodyValidation.message
      );
    }

    const result = dependencies.updateEntry.execute(
      keyValidation.value,
      bodyValidation.value.value
    );
    if (!result.ok && result.error === "KEY_NOT_FOUND") {
      return sendError(response, 404, result.error, "Key not found");
    }
    if (!result.ok && result.error === "CAPACITY_EXCEEDED") {
      return sendError(response, 507, result.error, "Cache capacity exceeded");
    }
    return response.status(204).send();
  });

  app.delete("/api/v1/keys/:key", (request, response) => {
    const validation = validateRouteKey(request.params.key);
    if (!validation.ok) {
      return sendError(response, 400, "VALIDATION_ERROR", validation.message);
    }

    const result = dependencies.deleteEntry.execute(validation.value);
    if (!result.ok) {
      return sendError(response, 404, result.error, "Key not found");
    }
    return response.status(204).send();
  });

  app.use((_request, response) => {
    sendError(response, 404, "ROUTE_NOT_FOUND", "Route not found");
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof URIError) {
      sendError(
        response,
        400,
        "VALIDATION_ERROR",
        "URL contains invalid percent-encoding"
      );
      return;
    }
    if (error instanceof SyntaxError) {
      sendError(response, 400, "INVALID_JSON", "Request body contains invalid JSON");
      return;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      sendError(response, 413, "PAYLOAD_TOO_LARGE", "Request body is too large");
      return;
    }
    sendError(response, 500, "INTERNAL_ERROR", "Internal server error");
  };
  app.use(errorHandler);

  return app;
}
