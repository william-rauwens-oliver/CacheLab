// Shared by the benchmark scripts: print the result table and save it as a JSON file in
// benchmarks/results/ (git-ignored), with the context needed to compare two runs later:
// date, Node version, machine and the benchmark's own settings.

import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RESULTS_DIRECTORY = fileURLToPath(new URL("./results/", import.meta.url));

export function saveResults(benchmark, settings, rows) {
  console.table(rows);

  const startedAt = new Date();
  const report = {
    benchmark,
    date: startedAt.toISOString(),
    node: process.version,
    machine: {
      platform: `${os.platform()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model ?? "unknown",
      cores: os.cpus().length,
      memoryGiB: Math.round(os.totalmem() / 1024 ** 3)
    },
    settings,
    rows
  };

  mkdirSync(RESULTS_DIRECTORY, { recursive: true });
  const fileName = `${benchmark}-${startedAt.toISOString().replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(RESULTS_DIRECTORY, fileName);
  writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Results saved to ${path.relative(process.cwd(), filePath)}`);
}
