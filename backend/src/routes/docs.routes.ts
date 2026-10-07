import { readFileSync } from "node:fs";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";

// Interactive API docs from docs/swagger.yaml (path is relative to the project root,
// which is the working directory for `npm run dev`, `npm start` and Docker).
const spec = parse(readFileSync("docs/swagger.yaml", "utf8")) as swaggerUi.JsonObject;

export const docsRouter = Router();

docsRouter.get("/swagger.json", (_req, res) => void res.json(spec));
docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: "Ridezy API Docs" }));
