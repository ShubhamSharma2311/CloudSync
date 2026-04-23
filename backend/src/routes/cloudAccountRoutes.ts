import { Router } from "express";
import {
  createCloudAccountController,
  listCloudAccountsController,
  verifyCloudAccountController,
} from "../controllers/cloudAccountController";
import {
  createCloudAccountSchema,
  listCloudAccountsQuerySchema,
  verifyCloudAccountBodySchema,
  verifyCloudAccountParamsSchema,
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

cloudAccountRouter.post(
  "/:cloudAccountId/verify",
  validateRequest({
    params: verifyCloudAccountParamsSchema,
    body: verifyCloudAccountBodySchema,
  }),
  attachRequestContext,
  verifyCloudAccountController
);

export { cloudAccountRouter };
