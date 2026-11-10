export interface RuntimeConfig {
  readonly cacheMaxBytes: number;
  readonly corsOrigins: readonly string[];
  readonly docsEnabled: boolean;
  readonly host: string;
  readonly httpBodyLimit: string;
  readonly port: number;
}

type Environment = Readonly<Record<string, string | undefined>>;

function positiveInteger(value: string | undefined, name: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`${name} must be a positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return parsed;
}

function booleanValue(value: string | undefined, name: string): boolean {
  const normalized = value?.trim().toLowerCase() ?? "false";
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}

export function loadRuntimeConfig(environment: Environment): RuntimeConfig {
  const port = positiveInteger(environment.PORT ?? "3000", "PORT");
  if (port > 65_535) {
    throw new Error("PORT must be between 1 and 65535");
  }
  const httpBodyLimit = environment.HTTP_BODY_LIMIT ?? "1mb";
  if (httpBodyLimit.trim() === "") {
    throw new Error("HTTP_BODY_LIMIT must not be empty");
  }

  return Object.freeze({
    cacheMaxBytes: positiveInteger(
      environment.CACHE_MAX_BYTES,
      "CACHE_MAX_BYTES"
    ),
    corsOrigins: Object.freeze(
      (environment.CORS_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    ),
    docsEnabled: booleanValue(environment.DOCS_ENABLED, "DOCS_ENABLED"),
    host: environment.HOST ?? "127.0.0.1",
    httpBodyLimit,
    port
  });
}
