import { getCollection } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import {
  optionalEnum,
  parsePagination,
  requireArray,
  requireEnum,
  requireNumber,
  requireObject,
  requireString,
  requireUrl,
} from "../../utils/validation.js";
import {
  CATEGORIES,
  FREE_SERVICE_LIMIT,
  MAX_SERVICE_IMAGES,
  SERVICE_STATUSES,
} from "../../utils/constants.js";
import { ObjectId } from "mongodb";

function toServiceId(id) {
  if (!ObjectId.isValid(id)) throw ApiError.notFound("Service not found");
  return new ObjectId(id);
}

/** Normalizes the image list: URLs only, deduped, bounded. */
function normalizeImages(value, field = "images") {
  if (value === undefined) return undefined;

  const list = requireArray(value, field, { min: 0, max: MAX_SERVICE_IMAGES });

  const urls = list.map((item, index) => requireUrl(item, `${field}[${index}]`));

  if (new Set(urls).size !== urls.length) {
    throw ApiError.unprocessable("Duplicate images are not allowed", [
      { field, message: "Each image may only appear once" },
    ]);
  }

  return urls;
}

/**
 * Free vendors get 3 live listings. Pending and approved both occupy a slot so
 * a vendor cannot dodge the limit by keeping everything in review; rejected
 * listings free their slot again.
 */
export async function assertQuota(vendor, { ignoreServiceId } = {}) {
  if (vendor.subscriptionPlan === "premium") return;

  const services = getCollection("services");
  const filter = {
    vendorId: vendor.id,
    status: { $in: ["pending", "approved"] },
  };

  if (ignoreServiceId) filter._id = { $ne: toServiceId(ignoreServiceId) };

  const used = await services.countDocuments(filter);

  if (used >= FREE_SERVICE_LIMIT) {
    throw new ApiError(
      403,
      `Your free plan allows ${FREE_SERVICE_LIMIT} services. Upgrade to Premium or remove one to add another.`
    );
  }
}

function readServicePayload(body, { partial = false } = {}) {
  const data = requireObject(body);

  const payload = {};

  if (!partial || data.serviceName !== undefined) {
    payload.serviceName = requireString(data.serviceName, "serviceName", { min: 3, max: 120 });
  }

  if (!partial || data.description !== undefined) {
    payload.description = requireString(data.description, "description", {
      min: 20,
      max: 2000,
    });
  }

  if (!partial || data.category !== undefined) {
    payload.category = requireEnum(data.category, "category", CATEGORIES);
  }

  if (!partial || data.price !== undefined) {
    payload.price = requireNumber(data.price, "price", { min: 0, max: 10_000_000 });
  }

  if (!partial || data.location !== undefined) {
    payload.location = requireString(data.location, "location", { min: 2, max: 120 });
  }

  const images = normalizeImages(data.images);
  if (images !== undefined) payload.images = images;

  if (data.availability !== undefined) {
    if (typeof data.availability !== "boolean") {
      throw ApiError.unprocessable("availability must be true or false", [
        { field: "availability", message: "availability must be true or false" },
      ]);
    }
    payload.availability = data.availability;
  } else if (!partial) {
    payload.availability = true;
  }

  if (
    !partial &&
    (!payload.images || payload.images.length === 0)
  ) {
    throw ApiError.unprocessable("At least one image is required", [
      { field: "images", message: "Upload at least one photo of your service" },
    ]);
  }

  return payload;
}

export async function createService(user, body) {
  const payload = readServicePayload(body);

  if (user.role !== "vendor" && user.role !== "admin") {
    throw ApiError.forbidden("Only vendors can create services");
  }

  await assertQuota({ id: user.id, subscriptionPlan: user.subscriptionPlan });

  const services = getCollection("services");
  const now = new Date();

  const document = {
    ...payload,
    vendorId: user.id,
    // Every new listing starts in review; admin approval publishes it.
    status: "pending",
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await services.insertOne(document);

  return { ...document, _id: result.insertedId };
}

/** Loads a service the caller is allowed to manage (owner or admin). */
export async function findOwnedService(user, id) {
  const services = getCollection("services");
  const service = await services.findOne({ _id: toServiceId(id) });

  if (!service) throw ApiError.notFound("Service not found");

  if (user.role !== "admin" && service.vendorId !== user.id) {
    throw ApiError.forbidden("You can only manage your own services");
  }

  return service;
}

export async function updateService(user, id, body) {
  const existing = await findOwnedService(user, id);
  const payload = readServicePayload(body, { partial: true });

  if (Object.keys(payload).length === 0) {
    throw ApiError.badRequest("No changes were provided");
  }

  // Vendor edits must be re-reviewed. Admin edits keep the current status so
  // moderation changes are not silently reverted.
  if (user.role !== "admin" && existing.status === "approved") {
    payload.status = "pending";
    payload.rejectionReason = null;
  }

  payload.updatedAt = new Date();

  const services = getCollection("services");
  await services.updateOne({ _id: existing._id }, { $set: payload });

  return { ...existing, ...payload };
}

export async function deleteService(user, id) {
  const existing = await findOwnedService(user, id);
  const services = getCollection("services");
  await services.deleteOne({ _id: existing._id });
  return { id: String(existing._id) };
}

export async function setAvailability(user, id, body) {
  if (typeof body?.availability !== "boolean") {
    throw ApiError.unprocessable("availability must be true or false", [
      { field: "availability", message: "availability must be true or false" },
    ]);
  }

  return updateService(user, id, { availability: body.availability });
}

/** Vendor dashboard list: every status, newest first, with usage stats. */
export async function listVendorServices(user, query) {
  const services = getCollection("services");
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 12, maxLimit: 48 });
  const status = optionalEnum(query.status, "status", SERVICE_STATUSES);

  const filter = { vendorId: user.id };
  if (status) filter.status = status;

  const [items, total, counts] = await Promise.all([
    services.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    services.countDocuments(filter),
    services
      .aggregate([
        { $match: { vendorId: user.id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const byStatus = Object.fromEntries(counts.map((row) => [row._id, row.count]));
  const used = (byStatus.pending ?? 0) + (byStatus.approved ?? 0);

  return {
    items,
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    quota: {
      plan: user.subscriptionPlan ?? "free",
      limit: user.subscriptionPlan === "premium" ? null : FREE_SERVICE_LIMIT,
      used,
      remaining:
        user.subscriptionPlan === "premium"
          ? null
          : Math.max(FREE_SERVICE_LIMIT - used, 0),
    },
  };
}

/** Single service for the owner/admin editor. */
export async function getManageableService(user, id) {
  const service = await findOwnedService(user, id);
  return service;
}
