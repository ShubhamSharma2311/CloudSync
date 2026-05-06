import { Router } from "express";
import {
  createScanController,
  listScansController,
  runAgentController,
  runMockScanController,
} from "../controllers/scanController";
import { attachRequestContext } from "../utils/requestContext";
import { createScanSchema, listScansQuerySchema } from "../utils/scanSchemas";
import { validateRequest } from "../utils/validation";

const scanRouter = Router();

scanRouter.get(
  "/",
  validateRequest({ query: listScansQuerySchema }),
  attachRequestContext,
  listScansController
);

scanRouter.post(
  "/",
  validateRequest({ body: createScanSchema }),
  attachRequestContext,
  createScanController
);

scanRouter.post(
  "/:id/run",
  attachRequestContext,
  runMockScanController
);

scanRouter.post(
  "/:id/run-agent",
  attachRequestContext,
  runAgentController
);

export { scanRouter };
