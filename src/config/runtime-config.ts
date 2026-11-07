export interface RuntimeConfig {
  readonly cacheMaxBytes: number;
  readonly host: string;
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

export function loadRuntimeConfig(environment: Environment): RuntimeConfig {
  const port = positiveInteger(environment.PORT ?? "3000", "PORT");
  if (port > 65_535) {
    throw new Error("PORT must be between 1 and 65535");
  }

  return Object.freeze({
    cacheMaxBytes: positiveInteger(
      environment.CACHE_MAX_BYTES,
      "CACHE_MAX_BYTES"
    ),
    host: environment.HOST ?? "127.0.0.1",
    port
  });
}
