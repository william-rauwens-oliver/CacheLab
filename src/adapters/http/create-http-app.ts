import cors from "cors";
import express from "express";
import helmet from "helmet";

import type { UpdateCacheEntry } from "../../application/use-cases/update-cache-entry.js";
import type { RuntimeConfig } from "../../config/runtime-config.js";
import { validateUpdateEntryInput } from "./validation.js";

interface HttpDependencies {
  readonly updateEntry: UpdateCacheEntry;
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

  app.put("/api/v1/keys/:key", (request, response) => {
    const input = validateUpdateEntryInput(request.body);
    if (input === undefined) {
      sendError(
        response,
        400,
        "VALIDATION_ERROR",
        "Body must contain only a string value"
      );
      return;
    }

    const result = dependencies.updateEntry.execute(
      request.params.key,
      input.value
    );
    if (result.ok) {
      response.status(204).end();
      return;
    }

    if (result.error === "KEY_NOT_FOUND") {
      sendError(response, 404, result.error, "Key not found");
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
