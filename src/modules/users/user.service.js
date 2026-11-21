import { ApiError } from "../../utils/api-error.js";
import { getCollection } from "../../config/db.js";
import { ObjectId } from "mongodb";

/**
 * Fields a person may change on their own account.
 *
 * Deliberately absent: `role`, `isBlocked`, `subscriptionPlan`,
 * `subscriptionExpiresAt` and `email`. Those are owned by the server — a user
 * who could send them would promote themselves to admin, unblock themselves or
 * grant free Premium. Email is excluded because changing it is a verification
 * flow, not a profile edit.
 */
const EDITABLE_FIELDS = ["name", "image", "businessName"];

export const PROFILE_CAPS = {
  name: { min: 2, max: 80 },
  businessName: { min: 0, max: 80 },
  image: { max: 500 },
};

function findUserFilter(id) {
  return {
    $or: [{ id }, ...(ObjectId.isValid(id) ? [{ _id: new ObjectId(id) }] : [])],
  };
}

function present(user) {
  return {
    id: String(user.id ?? user._id),
    name: user.name ?? "",
    email: user.email ?? "",
    image: user.image ?? null,
    role: user.role === "admin" || user.role === "vendor" ? user.role : "customer",
    businessName: user.businessName ?? null,
    isBlocked: Boolean(user.isBlocked),
    subscriptionPlan: user.subscriptionPlan === "premium" ? "premium" : "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt
      ? new Date(user.subscriptionExpiresAt).toISOString()
      : null,
    createdAt: user.createdAt ?? null,
  };
}

export async function getMe(userId) {
  const users = getCollection("users");
  const user = await users.findOne(findUserFilter(userId));

  if (!user) throw ApiError.notFound("Your account could not be loaded");

  return present(user);
}

/**
 * Updates only the whitelisted fields. Every rejected key is reported rather
 * than silently dropped, so a client bug is visible instead of looking like a
 * successful update.
 */
export async function updateMe(userId, body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw ApiError.unprocessable("Send an object with the fields you want to change");
  }

  const ignored = Object.keys(body).filter((key) => !EDITABLE_FIELDS.includes(key));

  if (ignored.length > 0) {
    throw ApiError.unprocessable(
      `These fields cannot be changed: ${ignored.join(", ")}`,
      ignored.map((field) => ({
        field,
        message:
          field === "email"
            ? "Email changes require a verification flow and are not available here"
            : `${field} is managed by the system and cannot be edited`,
      }))
    );
  }

  const users = getCollection("users");
  const user = await users.findOne(findUserFilter(userId));

  if (!user) throw ApiError.notFound("Your account could not be loaded");

  const patch = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      throw ApiError.unprocessable("name must be a string", [
        { field: "name", message: "name must be a string" },
      ]);
    }
    const name = body.name.trim();
    if (name.length < PROFILE_CAPS.name.min) {
      throw ApiError.unprocessable(`name must be at least ${PROFILE_CAPS.name.min} characters`, [
        { field: "name", message: `Enter at least ${PROFILE_CAPS.name.min} characters` },
      ]);
    }
    if (name.length > PROFILE_CAPS.name.max) {
      throw ApiError.unprocessable(`name must be at most ${PROFILE_CAPS.name.max} characters`, [
        { field: "name", message: `Use ${PROFILE_CAPS.name.max} characters or fewer` },
      ]);
    }
    patch.name = name;
  }

  if (body.businessName !== undefined) {
    if (body.businessName !== null && typeof body.businessName !== "string") {
      throw ApiError.unprocessable("businessName must be a string or null", [
        { field: "businessName", message: "businessName must be a string or null" },
      ]);
    }

    // Only vendors own a business name; for everyone else an empty value is
    // harmless but setting one would be meaningless.
    if (user.role !== "vendor") {
      if (typeof body.businessName === "string" && body.businessName.trim() !== "") {
        throw ApiError.forbidden("Only vendors can set a business name");
      }
    } else {
      const businessName = body.businessName === null ? "" : body.businessName.trim();
      if (businessName.length > PROFILE_CAPS.businessName.max) {
        throw ApiError.unprocessable(
          `businessName must be at most ${PROFILE_CAPS.businessName.max} characters`,
          [
            {
              field: "businessName",
              message: `Use ${PROFILE_CAPS.businessName.max} characters or fewer`,
            },
          ]
        );
      }
      // Empty clears the field rather than storing "" forever.
      patch.businessName = businessName === "" ? null : businessName;
    }
  }

  if (body.image !== undefined) {
    if (body.image !== null && typeof body.image !== "string") {
      throw ApiError.unprocessable("image must be a URL string or null", [
        { field: "image", message: "image must be a URL string or null" },
      ]);
    }

    if (body.image === null || body.image.trim() === "") {
      patch.image = null;
    } else {
      const image = body.image.trim();
      if (image.length > PROFILE_CAPS.image.max) {
        throw ApiError.unprocessable("That image URL is too long", [
          { field: "image", message: "Use a hosted image URL" },
        ]);
      }
      if (!/^https?:\/\//i.test(image)) {
        throw ApiError.unprocessable("image must be an http(s) URL", [
          { field: "image", message: "Upload the photo first, then save the returned URL" },
        ]);
      }
      patch.image = image;
    }
  }

  if (Object.keys(patch).length === 0) {
    return present(user);
  }

  patch.updatedAt = new Date();

  const updated = await users.findOneAndUpdate(
    { _id: user._id },
    { $set: patch },
    { returnDocument: "after" }
  );

  // Mirrors the Better Auth user shape; nothing here is derived.
  return present(updated ?? { ...user, ...patch });
}
