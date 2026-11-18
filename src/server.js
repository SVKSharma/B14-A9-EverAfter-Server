import app from "./app.js";
import { env } from "./config/env.js";
import { closeDB, connectDB } from "./config/db.js";

let retryTimer = null;

async function start() {
  // Production must fail fast when the database is unreachable.
  if (env.isProduction) {
    try {
      await connectDB();
    } catch (error) {
      console.error("[db] Connection failed:", error.message);
      process.exit(1);
    }
  }

  const server = app.listen(env.port, () => {
    console.log(`[api] EverAfter server listening on port ${env.port} (${env.nodeEnv})`);
    console.log(`[api] Health: http://localhost:${env.port}/api/health`);
  });

  // Development stays usable without a running MongoDB: boot in degraded mode
  // and reconnect automatically once the database becomes available.
  if (!env.isProduction) {
    try {
      await connectDB();
    } catch (error) {
      console.warn(`[db] ${error.message}`);
      console.warn(
        "[db] API running without a database (health reports degraded). Retrying every 15 seconds..."
      );
      retryTimer = setInterval(async () => {
        try {
          await connectDB();
          console.log("[db] MongoDB connected.");
          clearInterval(retryTimer);
          retryTimer = null;
        } catch {
          // keep retrying silently
        }
      }, 15000);
      retryTimer.unref();
    }
  }

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down...`);
    if (retryTimer) clearInterval(retryTimer);
    server.close(async () => {
      await closeDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

process.on("unhandledRejection", (reason) => {
  console.error("[api] Unhandled rejection:", reason);
});

start();
