import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as resourceService from "../services/resourceService";

export const listResourcesController = asyncHandler(async (req: Request, res: Response) => {
  const result = await resourceService.listResources(req.query as any);
  res.status(200).json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});

export const getResourceByIdController = asyncHandler(async (req: Request, res: Response) => {
  const result = await resourceService.getResourceById(req.params.id as string);
  res.status(200).json({
    success: true,
    data: result,
  });
});
