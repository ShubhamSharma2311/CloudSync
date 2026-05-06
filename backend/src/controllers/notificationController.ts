import type { RequestHandler } from "express";
import { listNotifications } from "../services/notificationService";
import { asyncHandler } from "../utils/asyncHandler";

export const listNotificationsController: RequestHandler = asyncHandler(
  async (req, res) => {
    const limitParam = Number.parseInt((req.query.limit as string) ?? "50", 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 200
      ? limitParam
      : 50;

    const items = await listNotifications(limit);
    res.status(200).json({
      requestId: res.locals.requestId ?? null,
      data: items,
      pagination: { limit, total: items.length },
    });
  }
);
