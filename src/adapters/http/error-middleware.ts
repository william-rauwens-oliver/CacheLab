import type { ErrorRequestHandler } from "express";

import { sendError } from "./error-response.js";
import type { HttpLogger } from "./http-logger.js";

function bodyParserType(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("type" in error)) {
    return undefined;
  }
  return typeof error.type === "string" ? error.type : undefined;
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }
  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  return undefined;
}

function isUriDecodingError(error: unknown): boolean {
  if (error instanceof URIError) {
    return true;
  }
  return (
    httpStatus(error) === 400 &&
    error instanceof Error &&
    /decode param/i.test(error.message)
  );
}

function safeErrorDetails(error: unknown): {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack !== undefined ? { stack: error.stack } : {})
    };
  }
  return { name: "Error", message: "Unknown error" };
}

export function createErrorMiddleware(logger: HttpLogger): ErrorRequestHandler {
  return (error, _request, response, _next) => {
    const type = bodyParserType(error);

    if (type === "entity.parse.failed") {
      sendError(
        response,
        400,
        "INVALID_JSON",
        "Request body contains invalid JSON"
      );
      return;
    }
    if (type === "entity.too.large") {
      sendError(
        response,
        413,
        "PAYLOAD_TOO_LARGE",
        "Request body is too large"
      );
      return;
    }
    if (type !== undefined) {
      sendError(response, 400, "VALIDATION_ERROR", "Invalid request");
      return;
    }

    if (error instanceof SyntaxError) {
      sendError(
        response,
        400,
        "INVALID_JSON",
        "Request body contains invalid JSON"
      );
      return;
    }

    if (isUriDecodingError(error)) {
      sendError(response, 400, "VALIDATION_ERROR", "Invalid URL encoding");
      return;
    }

    logger.error({ err: safeErrorDetails(error) }, "Unhandled HTTP error");
    sendError(response, 500, "INTERNAL_ERROR", "Internal server error");
  };
}
