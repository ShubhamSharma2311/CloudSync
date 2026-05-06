import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const attachRequestContext: RequestHandler = (req, res, next) => {
  // Idempotent: if a previous middleware (e.g. global mount in server.ts)
  // already attached the requestId, do nothing. Lets the same handler be
  // mounted both globally and per-route without double UUID generation.
  if (res.locals.requestId) {
    return next();
  }

  const requestIdHeader = req.header("x-request-id");
  const requestId =
    requestIdHeader && requestIdHeader.trim().length > 0
      ? requestIdHeader
      : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};
