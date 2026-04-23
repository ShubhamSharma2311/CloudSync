import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "./appError";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    requestId: res.locals.requestId ?? null,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} was not found`,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      requestId: res.locals.requestId ?? null,
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
    });
    return;
  }

  console.error("Unhandled server error", error);
  res.status(500).json({
    requestId: res.locals.requestId ?? null,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error",
    },
  });
};
