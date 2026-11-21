import express, { Router } from "express";
import { stripeWebhook } from "./webhook.controller.js";

const router = Router();

// `express.raw` is scoped to this router so only the webhook sees raw bytes.
router.post(
  "/stripe",
  express.raw({ type: "application/json", limit: "1mb" }),
  stripeWebhook
);

export default router;
