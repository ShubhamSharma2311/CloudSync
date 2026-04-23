import type { RequestHandler } from "express";
import {
  decideProposal,
  executeProposal,
  listProposals,
} from "../services/proposalService";
import { asyncHandler } from "../utils/asyncHandler";
import type {
  ListProposalsQuery,
  ProposalDecisionParams,
  ProposalDecisionPayload,
  ProposalExecutionParams,
  ProposalExecutionPayload,
} from "../utils/proposalSchemas";

export const listProposalsController: RequestHandler = asyncHandler(
  async (req, res) => {
    const query = req.query as unknown as ListProposalsQuery;
    const result = await listProposals(query);

    res.status(200).json({
      requestId: res.locals.requestId ?? null,
      data: result.items,
      pagination: result.pagination,
    });
  }
);

export const decideProposalController: RequestHandler = asyncHandler(
  async (req, res) => {
    const params = req.params as unknown as ProposalDecisionParams;
    const payload = req.body as ProposalDecisionPayload;
    const proposal = await decideProposal(params.proposalId, payload);

    res.status(200).json({
      requestId: res.locals.requestId ?? null,
      data: proposal,
    });
  }
);

export const executeProposalController: RequestHandler = asyncHandler(
  async (req, res) => {
    const params = req.params as unknown as ProposalExecutionParams;
    const payload = req.body as ProposalExecutionPayload;
    const proposal = await executeProposal(params.proposalId, payload);

    res.status(200).json({
      requestId: res.locals.requestId ?? null,
      data: proposal,
    });
  }
);
