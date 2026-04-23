import type { Request, RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "./appError";

type ValidationSchema = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

const parseSegment = (
  schema: ZodTypeAny | undefined,
  value: unknown,
  segment: "body" | "query" | "params"
): unknown => {
  if (!schema) {
    return value;
  }

  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError("Request validation failed", 400, "VALIDATION_ERROR", {
      segment,
      issues: result.error.issues,
    });
  }

  return result.data;
};

export const validateRequest = (schema: ValidationSchema): RequestHandler => {
  return (req, _res, next) => {
    try {
      req.body = parseSegment(schema.body, req.body, "body");
      req.query = parseSegment(schema.query, req.query, "query") as Request["query"];
      req.params = parseSegment(schema.params, req.params, "params") as Request["params"];
      next();
    } catch (error) {
      next(error);
    }
  };
};
