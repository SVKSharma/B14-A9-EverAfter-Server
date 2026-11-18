import { Router } from "express";
import { index, show } from "./service.controller.js";

const router = Router();

// Public catalogue: only approved + available services are returned.
// Authentication is not required to browse; the service details page is
// front-end protected until the auth phase adds server-side checks.
router.get("/", index);
router.get("/:id", show);

export default router;
