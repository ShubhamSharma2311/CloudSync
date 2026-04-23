import type { RequestHandler } from "express";
import {
  createCloudAccount,
  listCloudAccounts,
} from "../services/cloudAccountService";
import { asyncHandler } from "../utils/asyncHandler";
import type {
  CreateCloudAccountPayload,
  ListCloudAccountsQuery,
} from "../utils/cloudAccountSchemas";

export const createCloudAccountController: RequestHandler = asyncHandler(
  async (req, res) => {
    const payload = req.body as CreateCloudAccountPayload;
    const account = await createCloudAccount(payload);

    res.status(201).json({
      requestId: res.locals.requestId ?? null,
      data: account,
    });
  }
);

export const listCloudAccountsController: RequestHandler = asyncHandler(
  async (req, res) => {
    const query = req.query as unknown as ListCloudAccountsQuery;
    const result = await listCloudAccounts(query);

    res.status(200).json({
      requestId: res.locals.requestId ?? null,
      data: result.items,
      pagination: result.pagination,
    });
  }
);
