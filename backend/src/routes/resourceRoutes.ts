import { Router } from "express";
import {
  listResourcesController,
  getResourceByIdController,
} from "../controllers/resourceController";
import { validateRequest } from "../utils/validation";
import { getResourcesQuerySchema } from "../utils/resourceSchemas";

const resourceRouter = Router();

resourceRouter.get("/", validateRequest({ query: getResourcesQuerySchema }), listResourcesController);
resourceRouter.get("/:id", getResourceByIdController);

export { resourceRouter };
