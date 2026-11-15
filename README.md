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
| `npm run launch` | Install, load `.env`, validate and start the service |
| `npm start` | Run the compiled service |

Not implemented yet: key listing, structured logging, metrics, Docker, CI and
benchmarks.
