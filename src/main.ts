import { loadRuntimeConfig } from "./config/runtime-config.js";
import { createCacheLab } from "./app.js";

try {
  const config = loadRuntimeConfig(process.env);
  const { app, engine } = createCacheLab(config);
  const server = app.listen(config.port, config.host, () => {
    console.info(`CacheLab listening on http://${config.host}:${config.port}`);
    console.info(`Cache capacity: ${engine.getStats().maxBytes} bytes`);
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
