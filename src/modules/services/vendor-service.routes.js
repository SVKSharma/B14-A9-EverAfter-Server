import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import {
  create,
  myService,
  myServices,
  remove,
  toggleAvailability,
  update,
} from "./vendor-service.controller.js";

const router = Router();

// Everything below is mounted at /api/vendor/services and belongs to the
// signed-in vendor. Admins may also read/patch through the same handlers.
router.use(requireAuth, requireRole("vendor", "admin"));

router.get("/", myServices);
router.post("/", create);

router.get("/:id", myService);
router.patch("/:id", update);
router.patch("/:id/availability", toggleAvailability);
router.delete("/:id", remove);

export default router;
