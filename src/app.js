import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import apiRouter from "./routes/index.js";
import webhookRoutes from "./modules/subscriptions/webhook.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      return callback(null, env.allowedOrigins.includes(normalized));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Business routes are mounted before the body parser only when they need a raw
// payload (Stripe webhooks). They will be registered in their own module.

// Stripe signs the exact bytes it sends, so this router must be registered
// before `express.json()` parses the body.
app.use("/api/webhooks", webhookRoutes);

// Image uploads travel as base64 JSON, which inflates a 5 MB file to ~7 MB.
// Give that one path a larger cap while every other route keeps the 2 MB limit.
app.use("/api/uploads", express.json({ limit: "8mb" }));

app.use(express.json({ limit: "2mb" }));

app.use("/api", async (req, res, next) => {
  if (req.path === "/health") return next();

  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/", (req, res) => {
  res.json({ success: true, data: { name: "EverAfter API", health: "/api/health" } });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
