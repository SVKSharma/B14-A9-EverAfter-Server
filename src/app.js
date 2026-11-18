import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import apiRouter from "./routes/index.js";
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
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.json({ success: true, data: { name: "EverAfter API", health: "/api/health" } });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
