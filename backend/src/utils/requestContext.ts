import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const attachRequestContext: RequestHandler = (req, res, next) => {
  const requestIdHeader = req.header("x-request-id");
  const requestId =
    requestIdHeader && requestIdHeader.trim().length > 0
      ? requestIdHeader
      : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};
