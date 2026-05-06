// Typed error hierarchy. Every domain error extends AppError so the Express
// error handler can serialize it uniformly. Throw the most specific subclass
// at the throw site; catch AppError when you only care about HTTP-shaped errors
// (everything else is a real bug and should bubble to the unhandled path).

import { AppError } from "./appError";

export { AppError };

// 400 — request shape, body, params, or query failed validation.
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

// 401 — caller has no valid session/token.
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", details?: unknown) {
    super(message, 401, "UNAUTHORIZED", details);
    this.name = "UnauthorizedError";
  }
}

// 403 — caller is authenticated but the action is denied (RBAC, MFA missing).
export class ForbiddenError extends AppError {
  constructor(message = "Access denied", details?: unknown) {
    super(message, 403, "FORBIDDEN", details);
    this.name = "ForbiddenError";
  }
}

// 404 — resource doesn't exist or is filtered out by tenant scope.
export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 404, "NOT_FOUND", details);
    this.name = "NotFoundError";
  }
}

// 409 — state collision: e.g., scan requested against an unverified account,
// duplicate proposal approval, optimistic concurrency miss on a row lock.
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details);
    this.name = "ConflictError";
  }
}

// 400 — credential ciphertext failed format/decode/decrypt validation. Distinct
// from ValidationError so the credential vault can catch it specifically and
// emit a CREDENTIAL_INVALID audit log entry without string-matching codes.
export class CredentialError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "CREDENTIAL_ERROR", details);
    this.name = "CredentialError";
  }
}

// 502 — outbound call to AWS/GCP/Azure failed (network, throttling, auth from
// our side that the provider rejected). The agent retries via the scan runner;
// the API surface should NOT retry transparently — let the caller decide.
export class ProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, "PROVIDER_ERROR", details);
    this.name = "ProviderError";
  }
}
