import express, { type Express, type RequestHandler } from "express";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./utils/errorHandler";
import { attachRequestContext } from "./utils/requestContext";
import { getLogger } from "./utils/logger";

// Per-request access log: fires on response finish, captures method, path,
// status, duration, requestId. Stays inline because it's the only consumer.
const requestLogger: RequestHandler = (req, res, next) => {
  const logger = getLogger();
  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        requestId: res.locals.requestId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      },
      `${req.method} ${req.originalUrl} ${res.statusCode}`
    );
  });
  next();
};

export function createServer(): Express {
  const app = express();

  // Middleware order matters here — request id first so every later log line
  // can correlate, then body parser, then access log, then routes, then error
  // handlers as the terminal pair.
  app.use(attachRequestContext);
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
