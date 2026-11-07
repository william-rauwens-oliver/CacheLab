# CacheLab - storage engine

This first feature contains only the in-memory key/value storage engine described in the technical documentation.

Implemented:

- custom hash table without using `Map` as storage;
- `djb2` hashing;
- collision handling with separate chaining;
- synchronous create, read, update and delete operations;
- UTF-8 capacity limit;
- automatic resize above a `0.75` load factor;
- unit tests using the Node.js test runner.

Not implemented yet: REST API, Express, logging, metrics, OpenAPI, Docker, CI and benchmarks.

```bash
npm install
npm test
```
