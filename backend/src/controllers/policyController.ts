import type { RequestHandler } from "express";
import { listPolicies } from "../services/policyService";
import { asyncHandler } from "../utils/asyncHandler";
import type { ListPoliciesQuery } from "../utils/policySchemas";

export const listPoliciesController: RequestHandler = asyncHandler(
  async (req, res) => {
    const query = req.query as unknown as ListPoliciesQuery;
    const result = await listPolicies(query);

    res.status(200).json({
      requestId: res.locals.requestId ?? null,
      data: result.items,
      pagination: result.pagination,
    });
  }
);
