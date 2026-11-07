import { loadRuntimeConfig } from "./config/runtime-config.js";
import { createHttpServer } from "./http/create-http-server.js";
import { CustomHashTable } from "./storage/custom-hash-table.js";

try {
  const config = loadRuntimeConfig(process.env);
  const cache = new CustomHashTable(config.cacheMaxBytes);
  const server = createHttpServer();

  server.listen(config.port, config.host, () => {
    console.info(`CacheLab listening on http://${config.host}:${config.port}`);
    console.info(`Cache capacity: ${cache.getStats().maxBytes} bytes`);
  });

  const stop = () => {
    server.close((error) => {
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
