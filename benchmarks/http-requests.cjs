// Request builder used by benchmarks/http.mjs inside Autocannon worker threads.
// In workers mode Autocannon needs `setupRequest` as a file it can require (a function cannot be sent to a
// thread), and the file must be CommonJS, hence the .cjs extension.
// Every worker counts its own requests: request number `local` of worker `slot` gets the global index
// local * workers + slot. Slots are distinct, so two workers never build the same index: no key is created
// or deleted twice. The settings (which request, how many entries) arrive through `initialContext`.

const { threadId } = require("node:worker_threads");

const SCATTER_STEP = 7919;
const VALUE = "x".repeat(16);
const UPDATED_VALUE = "y".repeat(16);
const KEYS_PATH = "/api/v1/keys";
const JSON_HEADERS = { "content-type": "application/json" };

const keyPath = (index) => `${KEYS_PATH}/${encodeURIComponent(`key:${index}`)}`;

let local = 0;

module.exports = function setupRequest(request, context) {
  const { kind, entries, workers } = context;
  const index = local * workers + (threadId % workers);
  local += 1;
  const scattered = (index * SCATTER_STEP) % entries;

  switch (kind) {
    case "get":
      return Object.assign(request, { method: "GET", path: keyPath(scattered) });
    case "put":
      return Object.assign(request, {
        method: "PUT",
        path: keyPath(scattered),
        headers: JSON_HEADERS,
        body: JSON.stringify({ value: UPDATED_VALUE })
      });
    case "post":
      return Object.assign(request, {
        method: "POST",
        path: KEYS_PATH,
        headers: JSON_HEADERS,
        body: JSON.stringify({ key: `key:${entries + index}`, value: VALUE })
      });
    case "delete":
      return Object.assign(request, { method: "DELETE", path: keyPath(scattered) });
    default:
      throw new Error(`unknown request kind: ${kind}`);
  }
};
