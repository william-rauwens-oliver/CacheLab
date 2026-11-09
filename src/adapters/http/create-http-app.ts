import cors from "cors";
import express from "express";
import helmet from "helmet";

import type { CreateCacheEntry } from "../../application/use-cases/create-cache-entry.js";
import type { RuntimeConfig } from "../../config/runtime-config.js";
import { validateCreateEntryInput } from "./validation.js";

interface HttpDependencies {
  readonly createEntry: CreateCacheEntry;
}

function sendError(
  response: express.Response,
  status: number,
  code: string,
  message: string
) {
  response.status(status).json({ error: { code, message } });
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

  app.post("/api/v1/keys", (request, response) => {
    const input = validateCreateEntryInput(request.body);
    if (input === undefined) {
      sendError(
        response,
        400,
        "VALIDATION_ERROR",
        "Body must contain only a non-empty string key and a string value"
      );
      return;
    }

    const result = dependencies.createEntry.execute(input.key, input.value);
    if (result.ok) {
      response.status(201).end();
      return;
    }

    if (result.error === "KEY_ALREADY_EXISTS") {
      sendError(response, 409, result.error, "Key already exists");
      return;
    }

    sendError(response, 507, result.error, "Cache capacity exceeded");
  });

  app.use((_request, response) => {
    sendError(response, 404, "ROUTE_NOT_FOUND", "Route not found");
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction
    ) => {
      if (error instanceof SyntaxError) {
        sendError(
          response,
          400,
          "INVALID_JSON",
          "Request body contains invalid JSON"
        );
        return;
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "type" in error &&
        error.type === "entity.too.large"
      ) {
        sendError(
          response,
          413,
          "PAYLOAD_TOO_LARGE",
          "Request body is too large"
        );
        return;
      }

      sendError(response, 500, "INTERNAL_ERROR", "Internal server error");
    }
  );

  return app;
}
