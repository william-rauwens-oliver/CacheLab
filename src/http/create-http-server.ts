import { createServer, type Server, type ServerResponse } from "node:http";

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

export function createHttpServer(): Server {
  return createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      json(response, 200, { status: "ok" });
      return;
    }

    json(response, 404, {
      error: { code: "ROUTE_NOT_FOUND", message: "Route not found" }
    });
  });
}
