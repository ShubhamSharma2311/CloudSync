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

// Express 5 made req.query and req.params getter-only. Reassignment throws
// "Cannot set property X of #<IncomingMessage>". Object.defineProperty is the
// idiomatic workaround — redefines as a regular writable property so we can
// store the parsed/coerced result. req.body is still writable as before.
const assignSegment = (req: Request, segment: "body" | "query" | "params", value: unknown): void => {
  if (segment === "body") {
    req.body = value;
    return;
  }
  Object.defineProperty(req, segment, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
};

export const validateRequest = (schema: ValidationSchema): RequestHandler => {
  return (req, _res, next) => {
    try {
      if (schema.body) assignSegment(req, "body", parseSegment(schema.body, req.body, "body"));
      if (schema.query) assignSegment(req, "query", parseSegment(schema.query, req.query, "query"));
      if (schema.params) assignSegment(req, "params", parseSegment(schema.params, req.params, "params"));
      next();
    } catch (error) {
      next(error);
    }
  };
};
