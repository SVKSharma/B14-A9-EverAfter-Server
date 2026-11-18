import { Router } from "express";
import { pingDB } from "../config/db.js";
import { env } from "../config/env.js";
import serviceRoutes from "../modules/services/service.routes.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    data: {
      name: "EverAfter API",
      version: "1.0.0",
      message: "Your day. Your dream. Your Ever After.",
    },
  });
});

router.get("/health", async (req, res) => {
  const dbConnected = await pingDB();
  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    data: {
      status: dbConnected ? "ok" : "degraded",
      database: dbConnected ? "connected" : "disconnected",
      uptime: Math.round(process.uptime()),
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    },
  });
});

router.use("/services", serviceRoutes);

export default router;
