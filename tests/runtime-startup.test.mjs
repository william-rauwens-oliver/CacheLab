import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

function startWith(environment) {
  return spawnSync(process.execPath, ["dist/main.js"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      CACHE_MAX_BYTES: "1024",
      ...environment
    },
    timeout: 5_000
  });
}

for (const testCase of [
  {
    name: "HTTP_BODY_LIMIT",
    environment: { HTTP_BODY_LIMIT: "10zz" },
    expectedValue: "10zz"
  },
  {
    name: "HOST",
    environment: { HOST: "   " },
    expectedValue: "   "
  },
  {
    name: "PORT",
    environment: { PORT: "70000" },
    expectedValue: "70000"
  },
  {
    name: "DOCS_ENABLED",
    environment: { DOCS_ENABLED: "yes" },
    expectedValue: "yes"
  }
]) {
  test(`refuses startup when ${testCase.name} is invalid`, () => {
    const result = startWith(testCase.environment);

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(testCase.name));
    assert.match(result.stderr, new RegExp(testCase.expectedValue));
    assert.doesNotMatch(result.stdout, /CacheLab listening/);
  });
}
