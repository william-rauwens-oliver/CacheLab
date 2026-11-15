import { spawn } from "node:child_process";
import net from "node:net";

const MAIN_FILE = new URL("../../dist/main.js", import.meta.url).pathname;
const READY_MESSAGE = "CacheLab listening on";
const START_TIMEOUT_MS = 10_000;
const STOP_TIMEOUT_MS = 5_000;

export async function getFreePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

export async function startProcess(context, { port, cacheMaxBytes = 1024 }) {
  const child = spawn(process.execPath, [MAIN_FILE], {
    env: {
      PATH: process.env.PATH,
      HOST: "127.0.0.1",
      PORT: String(port),
      CACHE_MAX_BYTES: String(cacheMaxBytes)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  const exited = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  context.after(() => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CacheLab did not start within ${START_TIMEOUT_MS} ms.\n${output}`));
    }, START_TIMEOUT_MS);

    const check = () => {
      if (output.includes(READY_MESSAGE)) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on("data", check);
    exited.then(({ code, signal }) => {
      clearTimeout(timer);
      reject(new Error(`CacheLab exited before listening (code ${code}, signal ${signal}).\n${output}`));
    });
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    output: () => output,
    async stop(signal = "SIGTERM") {
      child.kill(signal);
      const timeout = new Promise((resolve) => {
        setTimeout(() => resolve("timeout"), STOP_TIMEOUT_MS).unref();
      });
      const result = await Promise.race([exited, timeout]);
      if (result === "timeout") {
        child.kill("SIGKILL");
        throw new Error(`CacheLab did not stop within ${STOP_TIMEOUT_MS} ms after ${signal}.\n${output}`);
      }
      return result;
    }
  };
}
