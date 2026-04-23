import { Router } from "express";
import {
  createCloudAccountController,
  listCloudAccountsController,
} from "../controllers/cloudAccountController";
import {
  createCloudAccountSchema,
  listCloudAccountsQuerySchema,
} from "../utils/cloudAccountSchemas";
import { attachRequestContext } from "../utils/requestContext";
import { validateRequest } from "../utils/validation";

const cloudAccountRouter = Router();

cloudAccountRouter.get(
  "/",
  validateRequest({ query: listCloudAccountsQuerySchema }),
  attachRequestContext,
  listCloudAccountsController
);

cloudAccountRouter.post(
  "/",
  validateRequest({ body: createCloudAccountSchema }),
  attachRequestContext,
  createCloudAccountController
);

export { cloudAccountRouter };
