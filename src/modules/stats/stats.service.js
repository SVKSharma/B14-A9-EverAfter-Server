import { getCollection } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { FREE_SERVICE_LIMIT } from "../../utils/constants.js";

/** Dashboard counters for the signed-in vendor. */
export async function vendorStats(user) {
  if (user.role !== "vendor" && user.role !== "admin") {
    throw ApiError.forbidden("Only vendors have a vendor dashboard");
  }

  const services = getCollection("services");
  const bookings = getCollection("bookings");
  const vendorId = user.id;

  const [totalServices, activeServices, pendingServices, pending, accepted, rejected] =
    await Promise.all([
      services.countDocuments({ vendorId }),
      services.countDocuments({ vendorId, status: "approved", availability: true }),
      services.countDocuments({ vendorId, status: "pending" }),
      bookings.countDocuments({ vendorId, status: "pending" }),
      bookings.countDocuments({ vendorId, status: "accepted" }),
      bookings.countDocuments({ vendorId, status: "rejected" }),
    ]);

  const plan = user.subscriptionPlan === "premium" ? "premium" : "free";
  const used = await services.countDocuments({
    vendorId,
    status: { $in: ["pending", "approved"] },
  });

  return {
    services: { total: totalServices, active: activeServices, pending: pendingServices },
    bookings: { pending, accepted, rejected },
    plan,
    quota: {
      plan,
      limit: plan === "premium" ? null : FREE_SERVICE_LIMIT,
      used,
      remaining: plan === "premium" ? null : Math.max(FREE_SERVICE_LIMIT - used, 0),
    },
  };
}

/** Dashboard counters for the signed-in customer. */
export async function customerStats(user) {
  if (user.role !== "customer" && user.role !== "admin") {
    throw ApiError.forbidden("Only customers have a customer dashboard");
  }

  const bookings = getCollection("bookings");
  const customerId = user.id;

  const [total, pending, accepted, rejected, cancelled] = await Promise.all([
    bookings.countDocuments({ customerId }),
    bookings.countDocuments({ customerId, status: "pending" }),
    bookings.countDocuments({ customerId, status: "accepted" }),
    bookings.countDocuments({ customerId, status: "rejected" }),
    bookings.countDocuments({ customerId, status: "cancelled" }),
  ]);

  return { bookings: { total, pending, accepted, rejected, cancelled } };
}
