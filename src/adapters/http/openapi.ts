import { readFileSync } from "node:fs";

import type { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";

const OPENAPI_FILE = new URL("../../../openapi.yaml", import.meta.url);

export function registerOpenApiDocumentation(app: Express) {
  const source = readFileSync(OPENAPI_FILE, "utf8");
  const document = parse(source);

  app.get("/openapi.yaml", (_request, response) => {
    response.type("application/yaml").status(200).send(source);
  });
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: "CacheLab API documentation"
    })
  );
}
