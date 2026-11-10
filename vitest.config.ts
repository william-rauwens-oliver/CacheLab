import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.vitest.ts"],
    exclude: ["tests/**/*.test.mjs", "node_modules", "dist"],
    environment: "node",
    fileParallelism: false
  }
});
