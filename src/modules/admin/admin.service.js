import { getCollection } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import {
  optionalEnum,
  optionalString,
  parsePagination,
  requireBoolean,
  requireObject,
} from "../../utils/validation.js";
import { CATEGORIES, SERVICE_STATUSES } from "../../utils/constants.js";
import { ObjectId } from "mongodb";

const ROLES = ["customer", "vendor", "admin"];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toServiceId(id) {
  if (!ObjectId.isValid(id)) throw ApiError.notFound("Service not found");
  return new ObjectId(id);
}

/**
 * Users are looked up by their Better Auth `id` (a hex string). Accepting the
 * Mongo `_id` too keeps ids copy-pasted from Atlas working.
 */
async function findUser(id) {
  const users = getCollection("users");
  const filter = { $or: [{ id }, ...(ObjectId.isValid(id) ? [{ _id: new ObjectId(id) }] : [])] };
  const user = await users.findOne(filter);
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

export async function adminStats() {
  const users = getCollection("users");
  const services = getCollection("services");
  const bookings = getCollection("bookings");
  const transactions = getCollection("transactions");

  const [
    totalUsers,
    customers,
    vendors,
    blockedUsers,
    totalServices,
    pendingServices,
    approvedServices,
    rejectedServices,
    totalBookings,
    pendingBookings,
    premiumVendors,
    totalTransactions,
    successfulTransactions,
  ] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ role: "customer" }),
    users.countDocuments({ role: "vendor" }),
    users.countDocuments({ isBlocked: true }),
    services.countDocuments({}),
    services.countDocuments({ status: "pending" }),
    services.countDocuments({ status: "approved" }),
    services.countDocuments({ status: "rejected" }),
    bookings.countDocuments({}),
    bookings.countDocuments({ status: "pending" }),
    users.countDocuments({ subscriptionPlan: "premium" }),
    transactions.countDocuments({}),
    transactions.countDocuments({ status: "success" }),
  ]);

  return {
    users: { total: totalUsers, customers, vendors, blocked: blockedUsers },
    services: {
      total: totalServices,
      pending: pendingServices,
      approved: approvedServices,
      rejected: rejectedServices,
    },
    bookings: { total: totalBookings, pending: pendingBookings },
    subscriptions: { premiumVendors, transactions: totalTransactions, successful: successfulTransactions },
  };
}

export async function listUsers(query) {
  const users = getCollection("users");
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 12, maxLimit: 50 });
  const role = optionalEnum(query.role, "role", ROLES);
  const search = optionalString(query.search, "search", { max: 120 });

  const filter = {};
  if (role) filter.role = role;

  if (search) {
    const pattern = escapeRegex(search);
    filter.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { email: { $regex: pattern, $options: "i" } },
      { businessName: { $regex: pattern, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    users
      .find(filter, {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          email: 1,
          image: 1,
          role: 1,
          isBlocked: 1,
          businessName: 1,
          subscriptionPlan: 1,
          subscriptionExpiresAt: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    users.countDocuments(filter),
  ]);

  return {
    items,
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function getUserDetail(id) {
  const user = await findUser(id);
  const services = getCollection("services");
  const bookings = getCollection("bookings");

  const [serviceCount, approvedServices, pendingServices, bookingCount, pendingBookings] =
    await Promise.all([
      services.countDocuments({ vendorId: user.id }),
      services.countDocuments({ vendorId: user.id, status: "approved" }),
      services.countDocuments({ vendorId: user.id, status: "pending" }),
      bookings.countDocuments({
        $or: [{ customerId: user.id }, { vendorId: user.id }],
      }),
      bookings.countDocuments({ customerId: user.id, status: "pending" }),
    ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: user.role,
    isBlocked: Boolean(user.isBlocked),
    businessName: user.businessName ?? null,
    subscriptionPlan: user.subscriptionPlan ?? "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
    createdAt: user.createdAt,
    counts: {
      services: serviceCount,
      approvedServices,
      pendingServices,
      bookings: bookingCount,
      pendingBookings,
    },
  };
}

/**
 * Blocking revokes access: the session-create hook rejects blocked users and
 * `requireAuth` returns 403 for existing sessions. Admins cannot block
 * themselves, which would otherwise lock the last admin out.
 */
export async function setUserBlocked(actor, id, body) {
  const data = requireObject(body);
  const isBlocked = requireBoolean(data.isBlocked, "isBlocked");

  const user = await findUser(id);

  if (user.id === actor.id) {
    throw ApiError.forbidden("You cannot block your own admin account");
  }

  if (user.role === "admin" && isBlocked) {
    throw ApiError.forbidden("Admin accounts cannot be blocked");
  }

  const users = getCollection("users");
  const updatedAt = new Date();
  await users.updateOne({ _id: user._id }, { $set: { isBlocked, updatedAt } });

  // Existing sessions must not outlive a block. Older rows may key on the
  // Mongo _id string rather than the mirrored id, so cover both.
  if (isBlocked) {
    await getCollection("sessions").deleteMany({
      userId: { $in: [user.id, String(user._id)].filter(Boolean) },
    });
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isBlocked,
  };
}

export async function listServices(query) {
  const services = getCollection("services");
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 12, maxLimit: 50 });
  const status = optionalEnum(query.status, "status", SERVICE_STATUSES);
  const category = optionalEnum(query.category, "category", CATEGORIES);
  const search = optionalString(query.search, "search", { max: 120 });

  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;

  if (search) {
    const pattern = escapeRegex(search);
    filter.$or = [
      { serviceName: { $regex: pattern, $options: "i" } },
      { description: { $regex: pattern, $options: "i" } },
      { location: { $regex: pattern, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    services
      .aggregate([
        { $match: filter },
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: "users",
            localField: "vendorId",
            foreignField: "id",
            as: "vendorDoc",
          },
        },
        { $unwind: { path: "$vendorDoc", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            vendor: {
              $cond: [
                { $ifNull: ["$vendorDoc", false] },
                {
                  id: "$vendorDoc.id",
                  name: "$vendorDoc.name",
                  businessName: { $ifNull: ["$vendorDoc.businessName", null] },
                  email: "$vendorDoc.email",
                  image: { $ifNull: ["$vendorDoc.image", null] },
                  subscriptionPlan: { $ifNull: ["$vendorDoc.subscriptionPlan", "free"] },
                },
                null,
              ],
            },
          },
        },
        { $project: { vendorDoc: 0 } },
      ])
      .toArray(),
    services.countDocuments(filter),
  ]);

  return {
    items,
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

/** Approve or reject a listing. Rejection records why so the vendor can fix it. */
export async function setServiceStatus(id, body) {
  const data = requireObject(body);
  const status = optionalEnum(data.status, "status", SERVICE_STATUSES);

  if (!status) {
    throw ApiError.unprocessable("status must be pending, approved or rejected", [
      { field: "status", message: "status must be pending, approved or rejected" },
    ]);
  }

  const reason = optionalString(data.rejectionReason, "rejectionReason", { max: 500 });

  if (status === "rejected" && !reason) {
    throw ApiError.unprocessable("Tell the vendor why the listing was rejected", [
      { field: "rejectionReason", message: "A rejection reason is required" },
    ]);
  }

  const services = getCollection("services");
  const service = await services.findOne({ _id: toServiceId(id) });

  if (!service) throw ApiError.notFound("Service not found");

  const updatedAt = new Date();
  const patch = {
    status,
    rejectionReason: status === "rejected" ? reason : null,
    updatedAt,
  };

  await services.updateOne({ _id: service._id }, { $set: patch });

  return { ...service, ...patch };
}

export async function deleteService(id) {
  const services = getCollection("services");
  const service = await services.findOne({ _id: toServiceId(id) });

  if (!service) throw ApiError.notFound("Service not found");

  await services.deleteOne({ _id: service._id });

  return { id: String(service._id), serviceName: service.serviceName };
}

export async function listTransactions(query) {
  const transactions = getCollection("transactions");
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 12, maxLimit: 50 });
  const status = optionalEnum(query.status, "status", [
    "pending",
    "success",
    "failed",
    "expired",
  ]);

  const filter = {};
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    transactions
      .aggregate([
        { $match: filter },
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: "users",
            localField: "vendorId",
            foreignField: "id",
            as: "vendorDoc",
          },
        },
        { $unwind: { path: "$vendorDoc", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            vendor: {
              $cond: [
                { $ifNull: ["$vendorDoc", false] },
                {
                  id: "$vendorDoc.id",
                  name: "$vendorDoc.name",
                  businessName: { $ifNull: ["$vendorDoc.businessName", null] },
                  email: "$vendorDoc.email",
                  image: { $ifNull: ["$vendorDoc.image", null] },
                },
                null,
              ],
            },
          },
        },
        { $project: { vendorDoc: 0 } },
      ])
      .toArray(),
    transactions.countDocuments(filter),
  ]);

  return {
    items,
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
