import type { RequestHandler } from "express";
import { createScan, listScans } from "../services/scanService";
import { asyncHandler } from "../utils/asyncHandler";
import type { CreateScanPayload, ListScansQuery } from "../utils/scanSchemas";

export const createScanController: RequestHandler = asyncHandler(async (req, res) => {
  const payload = req.body as CreateScanPayload;
  const scan = await createScan(payload);

  res.status(201).json({
    requestId: res.locals.requestId ?? null,
    data: scan,
  });
});

export const listScansController: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as ListScansQuery;
  const result = await listScans(query);

  res.status(200).json({
    requestId: res.locals.requestId ?? null,
    data: result.items,
    pagination: result.pagination,
  });
});
