import "dotenv/config";
import { loadConfig } from "./config/env";
import { getLogger } from "./utils/logger";
import { createServer } from "./server";
import { disconnectPrisma } from "./db/prisma";

async function main() {
  const config = loadConfig();
  const logger = getLogger();

  const app = createServer();
  const server = app.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, env: config.NODE_ENV },
      "CloudSync backend listening"
    );
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutdown initiated");
    server.close(async () => {
      try {
        await disconnectPrisma();
        logger.info("shutdown complete");
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "error during shutdown");
        process.exit(1);
      }
    });
    // Hard cap: if open connections refuse to close in 10s, kill the process.
    setTimeout(() => {
      logger.warn("forced shutdown after 10s timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  // No logger available yet — config validation may have failed.
  // This is the ONE place where console.error is acceptable.
  console.error("fatal boot error", err);
  process.exit(1);
});
