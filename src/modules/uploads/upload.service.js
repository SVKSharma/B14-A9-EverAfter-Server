import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";

export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const DATA_URI_PATTERN = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i;

/**
 * Accepts `data:image/<type>;base64,<payload>` and returns the decoded buffer.
 * The MIME type is whitelisted rather than trusted, and the decoded length is
 * checked so a small base64 string cannot expand past the limit.
 */
export function decodeImagePayload(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw ApiError.unprocessable("An image is required", [
      { field: "image", message: "Send { image: \"data:image/png;base64,...\" }" },
    ]);
  }

  const match = DATA_URI_PATTERN.exec(raw.trim());

  if (!match) {
    throw ApiError.unprocessable("Image must be a base64 data URI", [
      { field: "image", message: "Format must be data:image/<type>;base64,<data>" },
    ]);
  }

  const [, mime, base64] = match;
  const extension = ALLOWED_IMAGE_TYPES[mime.toLowerCase()];

  if (!extension) {
    throw ApiError.unprocessable("Unsupported image type", [
      {
        field: "image",
        message: `Allowed types: ${Object.keys(ALLOWED_IMAGE_TYPES).join(", ")}`,
      },
    ]);
  }

  const buffer = Buffer.from(base64, "base64");

  if (buffer.length === 0) {
    throw ApiError.unprocessable("Image data is empty", [
      { field: "image", message: "The base64 payload decoded to zero bytes" },
    ]);
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw ApiError.unprocessable("Image is too large", [
      { field: "image", message: "Maximum size is 5 MB" },
    ]);
  }

  return { buffer, mime, extension };
}

/**
 * Forwards the decoded image to ImgBB. The API key stays server-side; the
 * browser only ever sees the hosted URL.
 */
export async function uploadToImgbb(buffer, { name } = {}) {
  if (!env.imgbbApiKey) {
    throw new ApiError(503, "Image hosting is not configured on the server");
  }

  const form = new FormData();
  form.set("image", buffer.toString("base64"));
  if (name) form.set("name", name.slice(0, 60));

  let response;
  try {
    response = await fetch(`${IMGBB_ENDPOINT}?key=${encodeURIComponent(env.imgbbApiKey)}`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    console.error("[imgbb] request failed:", error.message);
    throw new ApiError(502, "Image host could not be reached. Please try again.");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success || !payload?.data?.url) {
    console.error("[imgbb] upload rejected:", response.status, payload?.error?.message);
    throw new ApiError(502, "Image upload failed. Please try another file.");
  }

  const data = payload.data;

  return {
    url: data.url,
    displayUrl: data.display_url ?? data.url,
    thumbnailUrl: data.thumb?.url ?? data.url,
    deleteUrl: data.delete_url ?? null,
    size: data.size ?? buffer.length,
    id: data.id ?? null,
  };
}
