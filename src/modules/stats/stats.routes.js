import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import { customerStats, vendorStats } from "./stats.service.js";

const router = Router();

// Mounted at /api/stats. Each endpoint is scoped to the caller's own records.
router.get("/vendor", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
  const stats = await vendorStats(req.user);
  res.json({ success: true, data: stats });
});

router.get("/customer", requireAuth, requireRole("customer", "admin"), async (req, res) => {
  const stats = await customerStats(req.user);
  res.json({ success: true, data: stats });
});

export default router;
