// Shared preparation of the HTTP benchmarks: start a real CacheLab process and fill it through the API.
// Used by benchmarks/http.mjs (Autocannon) and benchmarks/latency.mjs (latency probe), so both start from
// the same state. Filling is never measured.

import autocannon from "autocannon";

import { getFreePort, startProcess } from "../tests/helpers/start-process.mjs";

const VALUE = "x".repeat(16);
const KEYS_PATH = "/api/v1/keys";
const FILL_CONNECTIONS = 10;

export function assertClean(result) {
  if (result.non2xx !== 0 || result.errors !== 0 || result.timeouts !== 0) {
    throw new Error(
      `the run is not clean: ${result.non2xx} non-2xx, ${result.errors} errors, ${result.timeouts} timeouts`
    );
  }
}

// Starts a fresh CacheLab process holding exactly `entries` entries (key:0 ... key:entries-1).
// The caller must call server.stop() when done.
export async function startFilledServer(entries) {
  const server = await startProcess(
    { after: () => {} },
    { port: await getFreePort(), cacheMaxBytes: 1024 * 1024 * 1024 }
  );
  try {
    let next = 0;
    const result = await autocannon({
      url: server.baseUrl,
      connections: FILL_CONNECTIONS,
      amount: entries,
      requests: [
        {
          method: "POST",
          path: KEYS_PATH,
          headers: { "content-type": "application/json" },
          setupRequest: (request) => {
            request.body = JSON.stringify({ key: `key:${next}`, value: VALUE });
            next += 1;
            return request;
          }
        }
      ]
    });
    assertClean(result);
    if (result["2xx"] !== entries) {
      throw new Error(`preparation failed: ${result["2xx"]} created out of ${entries}`);
    }
    return server;
  } catch (error) {
    await server.stop();
    throw error;
  }
}
