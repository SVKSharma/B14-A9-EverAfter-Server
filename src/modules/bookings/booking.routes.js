import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
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

// Static segments are declared before "/:id" so they are never captured as ids.
router.get("/mine", mine);
router.get("/vendor", vendor);

router.post("/", create);
router.get("/:id", show);
router.patch("/:id/cancel", cancel);
router.patch("/:id/status", updateStatus);

export default router;
