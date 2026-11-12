export interface RuntimeConfig {
  readonly cacheMaxBytes: number;
  readonly corsOrigins: readonly string[];
  readonly docsEnabled: boolean;
  readonly host: string;
  readonly httpBodyLimit: string;
  readonly port: number;
  readonly shutdownTimeoutMs: number;
}

type Environment = Readonly<Record<string, string | undefined>>;

const HTTP_BODY_LIMIT_PATTERN = /^(\d+(?:\.\d+)?)(b|kb|mb|gb|tb|pb)$/i;

function receivedValue(value: string | undefined): string {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

function positiveInteger(value: string | undefined, name: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(
      `${name} must be a positive integer; received ${receivedValue(value)}`
    );
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${name} must be a positive safe integer; received ${receivedValue(value)}`
    );
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
  throw new Error(
    `${name} must be true or false; received ${receivedValue(value)}`
  );
}

function bodyLimitValue(value: string | undefined): string {
  const received = value ?? "1mb";
  const normalized = received.trim().toLowerCase();
  const match = HTTP_BODY_LIMIT_PATTERN.exec(normalized);
  if (match === null || Number(match[1]) <= 0) {
    throw new Error(
      "HTTP_BODY_LIMIT must be a positive size followed by b, kb, mb, gb, tb, or pb; " +
        `received ${receivedValue(value)}`
    );
  }
  return normalized;
}

function hostValue(value: string | undefined): string {
  const received = value ?? "127.0.0.1";
  const normalized = received.trim();
  if (normalized.length === 0) {
    throw new Error(`HOST must not be empty; received ${JSON.stringify(received)}`);
  }
  return normalized;
}

export function loadRuntimeConfig(environment: Environment): RuntimeConfig {
  const port = positiveInteger(environment.PORT ?? "3000", "PORT");
  if (port > 65_535) {
    throw new Error(
      `PORT must be between 1 and 65535; received ${receivedValue(environment.PORT)}`
    );
  }
  const httpBodyLimit = bodyLimitValue(environment.HTTP_BODY_LIMIT);

  return Object.freeze({
    cacheMaxBytes: positiveInteger(
      environment.CACHE_MAX_BYTES,
      "CACHE_MAX_BYTES"
    ),
    corsOrigins: Object.freeze(
      (environment.CORS_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    ),
    docsEnabled: booleanValue(environment.DOCS_ENABLED, "DOCS_ENABLED"),
    host: hostValue(environment.HOST),
    httpBodyLimit,
    port,
    shutdownTimeoutMs: positiveInteger(
      environment.SHUTDOWN_TIMEOUT_MS ?? "10000",
      "SHUTDOWN_TIMEOUT_MS"
    )
  });
}
