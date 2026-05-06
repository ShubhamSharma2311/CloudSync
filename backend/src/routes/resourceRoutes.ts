import { Router } from "express";
import {
  listResourcesController,
  getResourceByIdController,
  runCodeScanController,
} from "../controllers/resourceController";
import { validateRequest } from "../utils/validation";
import { getResourcesQuerySchema } from "../utils/resourceSchemas";
import { attachRequestContext } from "../utils/requestContext";

const resourceRouter = Router();

resourceRouter.get("/", validateRequest({ query: getResourcesQuerySchema }), listResourcesController);
resourceRouter.get("/:id", getResourceByIdController);
resourceRouter.post("/:id/code-scan", attachRequestContext, runCodeScanController);

export { resourceRouter };
