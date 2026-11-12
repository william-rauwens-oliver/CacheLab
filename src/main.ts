import type { Socket } from "node:net";

import { loadRuntimeConfig } from "./config/runtime-config.js";
import { createCacheLab } from "./app.js";

try {
  const config = loadRuntimeConfig(process.env);
  const { app, engine } = createCacheLab(config);
  const server = app.listen(config.port, config.host, () => {
    console.info(`CacheLab listening on http://${config.host}:${config.port}`);
    console.info(`Cache capacity: ${engine.getStats().maxBytes} bytes`);
  });

  const connections = new Set<Socket>();
  server.on("connection", (socket) => {
    connections.add(socket);
    socket.once("close", () => connections.delete(socket));
  });

  let stopping = false;
  const stop = () => {
    if (stopping) {
      return;
    }
    stopping = true;

    const forceCloseTimer = setTimeout(() => {
      console.warn(
        `Forcing shutdown after ${config.shutdownTimeoutMs} ms with ` +
          `${connections.size} connection(s) remaining`
      );
      for (const socket of connections) {
        socket.destroy();
      }
    }, config.shutdownTimeoutMs);

    server.close((error) => {
      clearTimeout(forceCloseTimer);
      if (error !== undefined) {
        console.error("CacheLab failed to stop cleanly", error);
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
} catch (error) {
  console.error("CacheLab failed to start", error);
  process.exitCode = 1;
}
