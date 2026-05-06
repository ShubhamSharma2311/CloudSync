import { Router } from "express";
import { listPoliciesController } from "../controllers/policyController";
import { listPoliciesQuerySchema } from "../utils/policySchemas";
import { attachRequestContext } from "../utils/requestContext";
import { validateRequest } from "../utils/validation";

const policyRouter = Router();

policyRouter.get(
  "/",
  validateRequest({ query: listPoliciesQuerySchema }),
  attachRequestContext,
  listPoliciesController
);

export { policyRouter };
