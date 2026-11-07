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
- minimal HTTP backend with a `GET /health` endpoint;
- external capacity and network configuration;
- safe default binding to `127.0.0.1`.

Not implemented yet: CRUD HTTP endpoints, logging, metrics, OpenAPI, Docker, CI and benchmarks.

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
`HOST` defaults to `127.0.0.1` and `PORT` defaults to `3000`.
