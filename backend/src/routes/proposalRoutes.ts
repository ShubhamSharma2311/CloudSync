import { Router } from "express";
import {
  decideProposalController,
  executeProposalController,
  listProposalsController,
} from "../controllers/proposalController";
import { attachRequestContext } from "../utils/requestContext";
import {
  listProposalsQuerySchema,
  proposalDecisionParamsSchema,
  proposalDecisionSchema,
  proposalExecutionParamsSchema,
  proposalExecutionSchema,
} from "../utils/proposalSchemas";
import { validateRequest } from "../utils/validation";

const proposalRouter = Router();

proposalRouter.get(
  "/",
  validateRequest({ query: listProposalsQuerySchema }),
  attachRequestContext,
  listProposalsController
);

proposalRouter.patch(
  "/:proposalId/decision",
  validateRequest({
    params: proposalDecisionParamsSchema,
    body: proposalDecisionSchema,
  }),
  attachRequestContext,
  decideProposalController
);

proposalRouter.post(
  "/:proposalId/execute",
  validateRequest({
    params: proposalExecutionParamsSchema,
    body: proposalExecutionSchema,
  }),
  attachRequestContext,
  executeProposalController
);

export { proposalRouter };
