import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import {
  blockUser,
  removeService,
  services,
  stats,
  transactions,
  updateServiceStatus,
  user,
  users,
} from "./admin.controller.js";

const router = Router();

// Every admin endpoint is closed to non-admins, including authenticated
// vendors and customers.
router.use(requireAuth, requireRole("admin"));

router.get("/stats", stats);

router.get("/users", users);
router.get("/users/:id", user);
router.patch("/users/:id/block", blockUser);

router.get("/services", services);
router.patch("/services/:id/status", updateServiceStatus);
router.delete("/services/:id", removeService);

// Transactions are read-only: only the Stripe webhook writes them.
router.get("/transactions", transactions);

export default router;
