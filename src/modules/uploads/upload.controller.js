import { decodeImagePayload, uploadToImgbb } from "./upload.service.js";

export async function uploadImage(req, res) {
  const { buffer, extension } = decodeImagePayload(req.body?.image);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;

  const image = await uploadToImgbb(buffer, {
    name: name || `everafter-${req.user.id}-${Date.now()}.${extension}`,
  });

  res.status(201).json({ success: true, data: image });
}
