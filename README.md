# CacheLab

CacheLab is a TypeScript backend for an in-memory key/value cache.

Implemented:

- custom hash table without using `Map` as storage;
- `djb2` hashing;
- collision handling with separate chaining;
- synchronous create, read, update and delete operations;
- exported `CacheStore` contract hiding the storage implementation;
- UTF-8 capacity limit;
- automatic resize above a `0.75` load factor;
- unit tests using the Node.js test runner.
- Express HTTP adapter with a `GET /health` endpoint;
- external capacity and network configuration;
- safe default binding to `127.0.0.1`.
- separated application ports, adapters, configuration and storage engine;
- `POST /api/v1/keys` with strict input validation and documented errors.
- `PUT /api/v1/keys/:key` with atomic value replacement and validation.
- `DELETE /api/v1/keys/:key` with explicit not-found handling.

Implemented API endpoints:

| Method | Path | Success |
|---|---|---|
| `POST` | `/api/v1/keys` | `201` |
| `GET` | `/api/v1/keys/:key` | `200` |
| `PUT` | `/api/v1/keys/:key` | `204` |
| `DELETE` | `/api/v1/keys/:key` | `204` |

POST expects a JSON body containing a non-empty string `key` and a string
`value`. GET returns `{ "key": string, "value": string }`. PUT expects a JSON
body containing only a string `value`.

Not implemented yet: listing keys, logging, metrics, OpenAPI, Docker, CI and benchmarks.

```bash
npm install
npm test
```

Start the backend:

```bash
cp .env.example .env
set -a
source .env
set +a
npm run build
npm start
```

Configuration is read from the environment. `CACHE_MAX_BYTES` is required;
`HOST` defaults to `127.0.0.1`, `PORT` to `3000`, and request bodies to `1mb`.
