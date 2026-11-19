import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { me, updateCurrentUser } from "./user.controller.js";

const router = Router();

// Anyone signed in may read and edit their own profile; there is no id in the
// path, so a user can never address somebody else's account here.
router.use(requireAuth);

router.get("/me", me);
router.patch("/me", updateCurrentUser);

export default router;
