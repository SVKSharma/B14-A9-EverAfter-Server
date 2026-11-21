import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import {
  cancel,
  create,
  mine,
  show,
  updateStatus,
  vendor,
} from "./booking.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/mine", requireRole("customer"), mine);
router.get("/vendor", requireRole("vendor"), vendor);

router.post("/", requireRole("customer"), create);
router.get("/:id", show);
router.patch("/:id/cancel", requireRole("customer", "admin"), cancel);
router.patch("/:id/status", requireRole("vendor", "admin"), updateStatus);

export default router;
