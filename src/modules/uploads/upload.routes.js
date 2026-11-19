import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { uploadImage } from "./upload.controller.js";

const router = Router();

// Any signed-in user may upload: vendors use it for services, everyone uses it
// for their avatar. Signed-out visitors must not reach ImgBB through us.
router.post("/image", requireAuth, uploadImage);

export default router;
