# LIV-008 - Installation and startup guide

This guide installs, validates and starts CacheLab on a local machine.

## Prerequisites

- Node.js 22.12.0 or later;
- npm 10 or later;
- a terminal using `zsh`, `bash` or an equivalent shell.

Check the installed versions:

```bash
node --version
npm --version
```

## Install dependencies

From the repository root:

```bash
cd /Applications/MAMP/htdocs/CacheLab
npm ci
```

`npm ci` uses the committed lock file and reproduces the dependency versions
used by the project.

## Configure the service

Create a local configuration file without overwriting an existing one:

```bash
cp -n .env.example .env
```

The example contains a valid local configuration. `CACHE_MAX_BYTES` is the only
required variable and must be a strictly positive integer.

Load the variables into the current terminal:

```bash
set -a
source .env
set +a
```

## Validate and build

```bash
npm run check
```

This command validates `openapi.yaml`, compiles TypeScript and runs the complete
automated test suite. To compile without running tests:

```bash
npm run build
```

## Run the tests

Every test command compiles TypeScript first, because the tests import the
compiled code in `dist/`. No environment variable is required: the tests start
their own servers on random local ports.

| Command | Purpose |
|---|---|
| `npm test` | Run the whole suite |
| `npm run test:unit` | Storage engine only (`tests/unit/`) |
| `npm run test:integration` | HTTP API, one real Express server per test (`tests/integration/`) |
| `npm run test:scenarios` | Business scenarios SC-001 to SC-006 (`tests/scenarios/`) |
| `npm run test:coverage` | Run the suite with coverage and enforce the thresholds |
| `npm run check` | Validate OpenAPI, then run the whole suite |

`npm run test:coverage` fails if line or branch coverage is below 80 % for the
whole source code, or below 90 % for the storage engine (`dist/engine/`).

The volume tests insert one million entries (about 20 seconds for the HTTP one),
so the whole suite takes around 20 seconds, and `npm run test:coverage` runs it twice.

The suite is deterministic: it gives the same result when run repeatedly, in any
file order and with any concurrency level. Tests marked `todo` document a known
defect: they run and report their failure without failing the suite, and they
are expected to start passing once the defect is fixed.

## Start and verify

```bash
npm start
```

The default address is `http://127.0.0.1:3000`. From another terminal:

```bash
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{"status":"ok"}
```

To enable interactive API documentation, set `DOCS_ENABLED=true`, reload the
environment and restart the service. Swagger UI is then available at
`http://127.0.0.1:3000/docs/` and the contract at
`http://127.0.0.1:3000/openapi.yaml`.

## Stop the service

Press `Ctrl+C` in the terminal running CacheLab. The process handles `SIGINT`
and `SIGTERM` by asking the HTTP server to close cleanly.

## Common startup errors

- `CACHE_MAX_BYTES must be a positive integer`: define a strictly positive
  integer in `.env`, then reload the file.
- `EADDRINUSE`: another process is using `PORT`; stop it or select another port.
- `Cannot find module`: run `npm ci`, then `npm run build` again.
- Swagger UI returns `404`: set `DOCS_ENABLED=true` and restart CacheLab.
