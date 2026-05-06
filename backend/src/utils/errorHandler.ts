import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "./appError";
import { getLogger } from "./logger";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    requestId: res.locals.requestId ?? null,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} was not found`,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const logger = getLogger();
  const requestId = res.locals.requestId ?? null;
  const requestContext = {
    requestId,
    method: req.method,
    url: req.originalUrl,
  };

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ ...requestContext, err: error, code: error.code }, "AppError 5xx");
    } else {
      logger.info(
        { ...requestContext, code: error.code, statusCode: error.statusCode },
        error.message
      );
    }
    res.status(error.statusCode).json({
      requestId,
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
    });
    return;
  }

  logger.error({ ...requestContext, err: error }, "Unhandled server error");
  res.status(500).json({
    requestId,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error",
    },
  });
};
