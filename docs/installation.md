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
- `HTTP_BODY_LIMIT` errors: use a positive size such as `512kb` or `2mb`.
- `HOST must not be empty`: provide a non-empty listening address.
- `PORT` errors: use a numeric value from 1 to 65535.
- `DOCS_ENABLED` errors: use only `true` or `false`.
- `SHUTDOWN_TIMEOUT_MS` errors: use a strictly positive integer in milliseconds.
- `EADDRINUSE`: another process is using `PORT`; stop it or select another port.
- `Cannot find module`: run `npm ci`, then `npm run build` again.
- Swagger UI returns `404`: set `DOCS_ENABLED=true` and restart CacheLab.
