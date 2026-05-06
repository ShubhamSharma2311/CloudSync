import pino, { type Logger } from "pino";
import { loadConfig, type AppConfig } from "../config/env";

const REDACT_PATHS = [
  // Generic secret-shaped fields anywhere in the log object.
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.authorization",
  "*.credentials",
  "*.credentialsCiphertext",
  "*.credentialsCiphertextBase64",
  // Top-level shapes the credential vault and config use directly.
  "credentialsCiphertext",
  "credentialsCiphertextBase64",
  // Specific env keys that end up in error contexts during boot.
  "*.GEMINI_API_KEY",
  "*.JWT_SECRET",
  "*.CREDENTIAL_ENCRYPTION_KEY",
  // Standard HTTP headers that carry auth material.
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie",
];

export function createLogger(config: AppConfig): Logger {
  const isDev = config.NODE_ENV === "development";

  return pino({
    level: config.LOG_LEVEL,
    base: {
      service: "cloudsync-backend",
      env: config.NODE_ENV,
    },
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  });
}

let cachedLogger: Logger | null = null;

export function getLogger(): Logger {
  if (cachedLogger) return cachedLogger;
  cachedLogger = createLogger(loadConfig());
  return cachedLogger;
}

export function resetLoggerForTests(): void {
  cachedLogger = null;
}
