import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { index, show } from "./service.controller.js";

const router = Router();

router.get("/", index);
router.get("/:id", requireAuth, show);

export default router;
