import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createHttpApp } from "../dist/adapters/http/create-http-app.js";
import { CreateCacheEntry } from "../dist/application/use-cases/create-cache-entry.js";
import { GetCacheEntry } from "../dist/application/use-cases/get-cache-entry.js";
import { InMemoryCacheRepository } from "../dist/adapters/storage/in-memory-cache-repository.js";
import { CustomHashTable } from "../dist/engine/hash-table/custom-hash-table.js";
import type { CacheRepository } from "../dist/application/ports/cache-repository.js";
import type { HttpLogger } from "../dist/adapters/http/http-logger.js";
import {
  validateCreateBody,
  validateKeyParam,
  validateUpdateBody
} from "../dist/adapters/http/validation.js";

const baseConfig = {
  cacheMaxBytes: 1024,
  corsOrigins: [] as const,
  host: "127.0.0.1",
  httpBodyLimit: "1kb",
  port: 3000
};

function buildApp(
  repository: CacheRepository,
  options: { logger?: HttpLogger; httpBodyLimit?: string } = {}
) {
  return createHttpApp(
    {
      ...baseConfig,
      ...(options.httpBodyLimit !== undefined
        ? { httpBodyLimit: options.httpBodyLimit }
        : {})
    },
    {
      createEntry: new CreateCacheEntry(repository),
      getEntry: new GetCacheEntry(repository)
    },
    { logger: options.logger }
  );
}

function realRepository(maxBytes = 1024) {
  const engine = new CustomHashTable(maxBytes);
  const repository = new InMemoryCacheRepository(engine);
  return { engine, repository };
}

describe("validation helpers", () => {
  it("accepts an empty string value on create and update", () => {
    expect(validateCreateBody({ key: "k", value: "" })).toEqual({
      ok: true,
      value: { key: "k", value: "" }
    });
    expect(validateUpdateBody({ value: "" })).toEqual({
      ok: true,
      value: { value: "" }
    });
  });

  it("rejects unknown fields and empty keys without trimming", () => {
    expect(validateCreateBody({ key: "k", value: "v", extra: true }).ok).toBe(
      false
    );
    expect(validateUpdateBody({ value: "v", extra: true }).ok).toBe(false);
    expect(validateKeyParam("").ok).toBe(false);
    expect(validateKeyParam(" spaced ").ok).toBe(true);
  });
});

describe("CAC-26 HTTP validation and errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 INVALID_JSON for malformed JSON", async () => {
    const { repository } = realRepository();
    const before = repository.getStats();
    const response = await request(buildApp(repository))
      .post("/api/v1/keys")
      .set("content-type", "application/json")
      .send("{not-json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON"
      }
    });
    expect(repository.getStats()).toEqual(before);
  });

  it("returns 400 VALIDATION_ERROR when the body is absent", async () => {
    const { repository } = realRepository();
    const before = repository.getStats();
    const response = await request(buildApp(repository)).post("/api/v1/keys");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(repository.getStats()).toEqual(before);
  });

  it("rejects missing, empty, or non-string keys without mutating the cache", async () => {
    const { repository } = realRepository();
    const before = repository.getStats();
    const app = buildApp(repository);

    for (const body of [
      { value: "v" },
      { key: "", value: "v" },
      { key: 42, value: "v" }
    ]) {
      const response = await request(app)
        .post("/api/v1/keys")
        .set("content-type", "application/json")
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }

    expect(repository.getStats()).toEqual(before);
  });

  it("rejects missing or non-string values without mutating the cache", async () => {
    const { repository } = realRepository();
    const before = repository.getStats();
    const app = buildApp(repository);

    for (const body of [{ key: "k" }, { key: "k", value: 1 }]) {
      const response = await request(app)
        .post("/api/v1/keys")
        .set("content-type", "application/json")
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }

    expect(repository.getStats()).toEqual(before);
  });

  it("rejects unknown fields without mutating the cache", async () => {
    const { repository } = realRepository();
    const before = repository.getStats();
    const response = await request(buildApp(repository))
      .post("/api/v1/keys")
      .set("content-type", "application/json")
      .send({ key: "k", value: "v", ttl: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(repository.getStats()).toEqual(before);
  });

  it("returns 400 VALIDATION_ERROR for invalid URL encoding", async () => {
    const { repository } = realRepository();
    const before = repository.getStats();
    const response = await request(buildApp(repository)).get(
      "/api/v1/keys/%E0%A4%A"
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid URL encoding"
      }
    });
    expect(repository.getStats()).toEqual(before);
  });

  it("returns 413 PAYLOAD_TOO_LARGE when the body exceeds HTTP_BODY_LIMIT", async () => {
    const { repository } = realRepository();
    const before = repository.getStats();
    const response = await request(
      buildApp(repository, { httpBodyLimit: "32b" })
    )
      .post("/api/v1/keys")
      .set("content-type", "application/json")
      .send({ key: "k", value: "x".repeat(200) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body is too large"
      }
    });
    expect(repository.getStats()).toEqual(before);
  });

  it("returns 409 on duplicate POST and keeps the original value (SC-002)", async () => {
    const { repository } = realRepository();
    const app = buildApp(repository);

    expect(
      (
        await request(app)
          .post("/api/v1/keys")
          .set("content-type", "application/json")
          .send({ key: "same", value: "original" })
      ).status
    ).toBe(201);

    const duplicate = await request(app)
      .post("/api/v1/keys")
      .set("content-type", "application/json")
      .send({ key: "same", value: "replacement" });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({
      error: {
        code: "KEY_ALREADY_EXISTS",
        message: "Key already exists"
      }
    });

    const read = await request(app).get("/api/v1/keys/same");
    expect(read.status).toBe(200);
    expect(read.body).toEqual({ key: "same", value: "original" });
  });

  it("returns 404 KEY_NOT_FOUND for an absent key", async () => {
    const { repository } = realRepository();
    const response = await request(buildApp(repository)).get(
      "/api/v1/keys/missing"
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "KEY_NOT_FOUND",
        message: "Key not found"
      }
    });
  });

  it("returns 404 ROUTE_NOT_FOUND for an unknown route", async () => {
    const { repository } = realRepository();
    const response = await request(buildApp(repository)).get("/nope");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found"
      }
    });
  });

  it("maps CAPACITY_EXCEEDED from a fake repository to 507", async () => {
    const fake: CacheRepository = {
      create: () => ({ ok: false, error: "CAPACITY_EXCEEDED" }),
      get: () => ({ ok: false, error: "KEY_NOT_FOUND" }),
      update: () => ({ ok: false, error: "CAPACITY_EXCEEDED" }),
      delete: () => ({ ok: false, error: "KEY_NOT_FOUND" }),
      getStats: () => ({
        entryCount: 0,
        usedBytes: 0,
        maxBytes: 1,
        bucketCount: 16,
        collisionCount: 0,
        resizeCount: 0
      })
    };

    const response = await request(buildApp(fake))
      .post("/api/v1/keys")
      .set("content-type", "application/json")
      .send({ key: "k", value: "v" });

    expect(response.status).toBe(507);
    expect(response.body).toEqual({
      error: {
        code: "CAPACITY_EXCEEDED",
        message: "Cache capacity exceeded"
      }
    });
  });

  it("returns a generic 500 without leaking internals and keeps serving", async () => {
    const logger: HttpLogger = { error: vi.fn() };
    let shouldThrow = true;
    const fake: CacheRepository = {
      create: () => {
        if (shouldThrow) {
          throw new Error("engine failure");
        }
        return { ok: true };
      },
      get: () => ({ ok: true, value: "ok" }),
      update: () => ({ ok: true }),
      delete: () => ({ ok: true }),
      getStats: () => ({
        entryCount: 0,
        usedBytes: 0,
        maxBytes: 1024,
        bucketCount: 16,
        collisionCount: 0,
        resizeCount: 0
      })
    };
    const app = buildApp(fake, { logger });

    const failed = await request(app)
      .post("/api/v1/keys")
      .set("content-type", "application/json")
      .send({ key: "boom", value: "payload-secret" });

    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      }
    });
    const serialized = JSON.stringify(failed.body);
    expect(serialized).not.toMatch(/stack|engine failure|payload-secret|boom/i);
    expect(logger.error).toHaveBeenCalledOnce();
    const [logged] = vi.mocked(logger.error).mock.calls[0] ?? [];
    expect(logged).toMatchObject({
      err: { name: "Error", message: "engine failure" }
    });
    expect((logged as { err: { stack?: string } }).err.stack).toBeTypeOf(
      "string"
    );
    expect(logged).not.toHaveProperty("body");
    expect(logged).not.toHaveProperty("key");
    expect(logged).not.toHaveProperty("value");
    expect(JSON.stringify(logged)).not.toMatch(/payload-secret|boom/);

    shouldThrow = false;
    const next = await request(app)
      .post("/api/v1/keys")
      .set("content-type", "application/json")
      .send({ key: "ok", value: "after" });
    expect(next.status).toBe(201);
  });

  it("accepts an empty string value on POST", async () => {
    const { repository } = realRepository();
    const response = await request(buildApp(repository))
      .post("/api/v1/keys")
      .set("content-type", "application/json")
      .send({ key: "empty", value: "" });

    expect(response.status).toBe(201);
    expect(repository.get("empty")).toEqual({ ok: true, value: "" });
  });
});
