import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import { checkout, session, status } from "./subscription.controller.js";

const router = Router();

router.use(requireAuth, requireRole("vendor"));

router.get("/status", status);

// A vendor can only start a checkout for their own account: there is no
// vendorId in the body, the id always comes from the session.
router.post("/checkout", checkout);

// Used by the success page to show what Stripe recorded. It never activates a
// plan; the webhook is the only writer.
router.get("/session", session);

export default router;
