import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createConnection, createServer } from "node:net";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function availablePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert.equal(typeof address, "object");
  await new Promise((resolve) => probe.close(resolve));
  return address.port;
}

function waitForText(stream, pattern, timeoutMs = 2_000) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${pattern}; received ${output}`));
    }, timeoutMs);
    const onData = (chunk) => {
      output += chunk.toString();
      if (pattern.test(output)) {
        cleanup();
        resolve(output);
      }
    };
    const cleanup = () => {
      clearTimeout(timeout);
      stream.off("data", onData);
    };
    stream.on("data", onData);
  });
}

function waitForExit(child, timeoutMs = 2_000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve([child.exitCode, child.signalCode]);
  }

  return Promise.race([
    once(child, "exit"),
    delay(timeoutMs).then(() => {
      throw new Error("Timed out waiting for CacheLab to exit");
    })
  ]);
}

async function startService(shutdownTimeoutMs) {
  const port = await availablePort();
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      CACHE_MAX_BYTES: "1024",
      CORS_ORIGINS: "",
      DOCS_ENABLED: "false",
      HOST: "127.0.0.1",
      HTTP_BODY_LIMIT: "1mb",
      PORT: String(port),
      SHUTDOWN_TIMEOUT_MS: String(shutdownTimeoutMs)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  await waitForText(child.stdout, /CacheLab listening/);
  return { child, port, stderr: () => stderr };
}

async function canConnect(port) {
  return new Promise((resolve) => {
    const socket = createConnection(port, "127.0.0.1");
    socket.setTimeout(250);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  test(`stops immediately on ${signal} when no request is active`, async (context) => {
    const service = await startService(2_000);
    context.after(() => {
      if (service.child.exitCode === null && service.child.signalCode === null) {
        service.child.kill("SIGKILL");
      }
    });

    const startedAt = Date.now();
    service.child.kill(signal);
    const [exitCode, exitSignal] = await waitForExit(service.child);

    assert.equal(exitCode, 0);
    assert.equal(exitSignal, null);
    assert.ok(Date.now() - startedAt < 1_000);
    assert.doesNotMatch(service.stderr(), /Forcing shutdown/);
  });
}

test("forces an incomplete HTTP connection closed after the configured timeout", async (context) => {
  const shutdownTimeoutMs = 150;
  const service = await startService(shutdownTimeoutMs);
  context.after(() => {
    if (service.child.exitCode === null && service.child.signalCode === null) {
      service.child.kill("SIGKILL");
    }
  });

  const socket = createConnection(service.port, "127.0.0.1");
  socket.on("error", () => {});
  await once(socket, "connect");
  socket.write(
    "POST /api/v1/keys HTTP/1.1\r\n" +
      "Host: 127.0.0.1\r\n" +
      "Content-Type: application/json\r\n" +
      "Content-Length: 100\r\n\r\n" +
      "{"
  );

  const startedAt = Date.now();
  service.child.kill("SIGTERM");
  await delay(30);
  assert.equal(await canConnect(service.port), false);

  const [exitCode, exitSignal] = await waitForExit(service.child);
  assert.equal(exitCode, 0);
  assert.equal(exitSignal, null);
  assert.ok(Date.now() - startedAt < 1_500);
  assert.match(service.stderr(), /Forcing shutdown after 150 ms/);
  socket.destroy();
});
