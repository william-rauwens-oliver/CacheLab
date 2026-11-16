# CacheLab

CacheLab is a TypeScript and Express service that stores string key/value pairs
in memory. Its custom hash table supports collision handling, automatic resize,
UTF-8 capacity accounting and atomic CRUD operations without using `Map` as the
storage engine.

## API

| Method | Path | Success |
|---|---|---|
| `POST` | `/api/v1/keys` | `201` |
| `GET` | `/api/v1/keys/:key` | `200` |
| `PUT` | `/api/v1/keys/:key` | `204` |
| `DELETE` | `/api/v1/keys/:key` | `204` |

The versioned OpenAPI 3.1 contract is in [`openapi.yaml`](openapi.yaml). When
`DOCS_ENABLED=true`, the running service exposes:

- Swagger UI at `http://127.0.0.1:3000/docs/`;
- the source contract at `http://127.0.0.1:3000/openapi.yaml`.

Documentation is disabled by default and must not be exposed directly to the
public Internet.

## Quick start

```bash
npm run launch
```

`CACHE_MAX_BYTES` is required. The example configuration starts a local-only
service on `127.0.0.1:3000` with a logical cache capacity of 1 MiB.
The launch command installs locked dependencies, loads `.env`, validates the
project and starts the service.

## Project guides

- [LIV-008 - Installation and startup](docs/installation.md)
- [LIV-009 - Configuration and operations](docs/operations.md)

## Useful commands

| Command | Purpose |
|---|---|
| `npm run build` | Compile TypeScript into `dist/` |
| `npm test` | Compile and run the automated tests |
| `npm run test:unit`, `test:integration`, `test:scenarios` | Run one level of tests |
| `npm run test:coverage` | Run the tests and enforce the coverage thresholds |
| `npm run typecheck:contracts` | Verify operation-specific repository result types |
| `npm run openapi:lint` | Validate and lint `openapi.yaml` |
| `npm run check` | Validate OpenAPI, compile and run all tests |
| `npm run bench:engine`, `bench:structure`, `bench:http`, `bench:latency` | Run one benchmark (see [Benchmarks](#benchmarks)) |
| `npm run launch` | Install, load `.env`, validate and start the service |
| `npm start` | Run the compiled service |

## Tests

The tests use the built-in `node:test` runner and need no environment variable:
each test starts its own server on a random local port. Every test command
compiles TypeScript first, because the tests import the compiled code in `dist/`.

| Level | Folder | What it covers | Command |
|---|---|---|---|
| Unit | `tests/unit/` | The storage engine alone: CRUD, collisions, resize, capacity, UTF-8 accounting, one million entries | `npm run test:unit` |
| Integration | `tests/integration/` | The HTTP API on a real Express server: statuses, error format, validation, one million `POST` through Autocannon | `npm run test:integration` |
| Scenarios | `tests/scenarios/` | Business scenarios SC-001 to SC-006 | `npm run test:scenarios` |

`npm test` runs the three levels (about 20 seconds, because of the volume tests).
`npm run test:coverage` runs them twice and fails if line or branch coverage is
below 80 % for the whole source code, or below 90 % for the storage engine
(`dist/engine/`). The suite is deterministic: same result in any file order and
with any concurrency level.

## Benchmarks

The benchmarks measure speed; they are not tests and never fail on a slow
result. They compile the project first, then print a table and save the same
numbers as a JSON file in `benchmarks/results/` (ignored by git), together with
the date, the Node version, the machine and the settings used.

| Command | What it measures | Duration |
|---|---|---|
| `npm run bench:engine` | The storage engine alone, without HTTP: `get` (existing and absent key), `update`, `delete` and `create`, on 10,000 then 1,000,000 entries, with Tinybench | about 15 s |
| `npm run bench:structure` | The two cases specific to a hand-written hash table: `get` at the end of a collision chain of 1 to 1,000 keys, and the cost and memory of the `create` that triggers a resize | about 1 min |
| `npm run bench:http` | The real HTTP service under load with Autocannon: `GET`, `PUT`, `POST`, `DELETE`, requests per second | about 45 s |
| `npm run bench:latency` | The latency of every single HTTP request, timed with a nanosecond clock, at 1 and 10 connections (min to p99 in microseconds) | about 2 min |

The HTTP benchmark can send its load from several client threads:

```bash
BENCH_WORKERS=4 BENCH_CONNECTIONS=40 npm run bench:http
```

How to read the results:

- The engine benchmarks time batches of 1,000 calls, because one call is shorter
  than the timer resolution. Their percentiles are percentiles of batch means.
- Autocannon reports latency in whole milliseconds, so use `bench:http` for
  throughput and `bench:latency` for latency.
- Each figure comes from a single run on one machine, with the client and the
  server sharing the same processor. Compare runs made on the same machine, with
  no other heavy program running, and treat differences of a few tens of percent
  as noise.
- Never run two benchmarks at the same time: they would measure each other.

Not implemented yet: key listing, structured logging, metrics, Docker and CI.