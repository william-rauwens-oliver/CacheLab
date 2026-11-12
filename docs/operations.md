# LIV-009 - Configuration and operations guide

CacheLab is a single-process, in-memory service. Its configuration is loaded and
validated at startup and remains fixed until the next restart.

## Configuration reference

| Variable | Default | Description |
|---|---:|---|
| `CACHE_MAX_BYTES` | Required | Maximum logical cache capacity in UTF-8 bytes |
| `HOST` | `127.0.0.1` | Non-empty network address used by the HTTP server |
| `PORT` | `3000` | HTTP listening port, from 1 to 65535 |
| `HTTP_BODY_LIMIT` | `1mb` | Positive size followed by `b`, `kb`, `mb`, `gb`, `tb` or `pb` |
| `CORS_ORIGINS` | Empty | Comma-separated list of allowed browser origins |
| `DOCS_ENABLED` | `false` | Exposes `/docs` and `/openapi.yaml` when `true` |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Positive maximum graceful-shutdown delay in milliseconds |

Invalid values prevent the service from starting with a non-zero exit code. The
error names the invalid variable and received value. `.env` is local and
ignored by Git; `.env.example` is the versioned reference and contains no
secrets.

## Capacity and memory

`CACHE_MAX_BYTES` limits the sum of the UTF-8 byte sizes of stored keys and
values. It does not include JavaScript objects, hash-table buckets, temporary
allocations or the Node.js runtime. It is therefore a logical capacity, not a
hard limit on the process RAM.

Create and update operations that would exceed the configured capacity return
`507 CAPACITY_EXCEEDED` without changing existing data. CacheLab performs no
automatic eviction. Delete operations release the logical capacity occupied by
the removed key and value.

The host or container must reserve additional memory for V8 and internal data
structures. Monitor the real Node.js process separately from CacheLab's logical
capacity.

## Network exposure

The safe default `HOST=127.0.0.1` accepts only local connections. Set
`HOST=0.0.0.0` only behind a trusted network boundary or reverse proxy. CacheLab
does not currently include authentication and must not be exposed directly to
the public Internet. Helmet and CORS do not replace network access control or
HTTPS termination.

Keep `CORS_ORIGINS` empty when browser access is not needed. Otherwise, list
only explicit trusted origins, separated by commas.

API documentation is disabled by default. Enable it only in an authorized
environment and apply the same network restrictions as the API.

## Stop and restart

Send `SIGINT` (`Ctrl+C`) or `SIGTERM` to request a clean HTTP server shutdown.
The server immediately stops accepting new connections and waits for active
connections to finish. After `SHUTDOWN_TIMEOUT_MS`, any remaining connections
are destroyed so the process can exit. With no active request, shutdown is
immediate and does not wait for the configured timeout.

Restart with the same validated sequence:

```bash
set -a
source .env
set +a
npm run build
npm start
```

## Volatile storage

All entries live only in the memory of one Node.js process. Every stop, crash,
restart or replacement starts with an empty cache. There is no persistence,
backup, replication or synchronization between instances. Clients must treat
the original data source as authoritative and be able to repopulate the cache.

## Operational checks

- call `GET /health` to verify that the process answers HTTP requests;
- run `npm run check` before a release;
- verify `HOST`, `CORS_ORIGINS` and `DOCS_ENABLED` before external deployment;
- size real process memory above `CACHE_MAX_BYTES`;
- expect an empty cache after every restart.
