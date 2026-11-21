import { getCollection } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import {
  optionalEnum,
  parsePagination,
  requireDate,
  requireObject,
  requireString,
} from "../../utils/validation.js";
import { BOOKING_STATUSES } from "../../utils/constants.js";
import { ObjectId } from "mongodb";

const ACTIVE_STATUSES = ["pending", "accepted"];

function toObjectId(id, message = "Booking not found") {
  if (!ObjectId.isValid(id)) throw ApiError.notFound(message);
  return new ObjectId(id);
}

/** Every booking is anchored to a calendar day, stored as UTC midnight. */
function startOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function readBookingPayload(body) {
  const data = requireObject(body);

  return {
    eventDate: startOfDay(requireDate(data.eventDate, "eventDate", { future: true })),
    eventLocation: requireString(data.eventLocation, "eventLocation", { min: 2, max: 160 }),
    message: requireString(data.message, "message", { min: 10, max: 1000 }),
  };
}

const SERVICE_LOOKUP = [
  {
    $lookup: {
      from: "services",
      localField: "serviceId",
      foreignField: "_id",
      as: "serviceDoc",
    },
  },
  { $unwind: { path: "$serviceDoc", preserveNullAndEmptyArrays: true } },
];

const USER_LOOKUPS = [
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
    $lookup: {
      from: "users",
      localField: "customerId",
      foreignField: "id",
      as: "customerDoc",
    },
  },
  { $unwind: { path: "$customerDoc", preserveNullAndEmptyArrays: true } },
];

const BOOKING_SHAPE = [
  {
    $addFields: {
      service: {
        $cond: [
          { $ifNull: ["$serviceDoc", false] },
          {
            _id: "$serviceDoc._id",
            serviceName: "$serviceDoc.serviceName",
            images: { $ifNull: ["$serviceDoc.images", []] },
            price: "$serviceDoc.price",
            location: "$serviceDoc.location",
            category: { $ifNull: ["$serviceDoc.category", null] },
          },
          null,
        ],
      },
      vendor: {
        $cond: [
          { $ifNull: ["$vendorDoc", false] },
          {
            id: "$vendorDoc.id",
            name: "$vendorDoc.name",
            businessName: { $ifNull: ["$vendorDoc.businessName", null] },
            image: { $ifNull: ["$vendorDoc.image", null] },
            subscriptionPlan: { $ifNull: ["$vendorDoc.subscriptionPlan", "free"] },
          },
          null,
        ],
      },
      customer: {
        $cond: [
          { $ifNull: ["$customerDoc", false] },
          {
            id: "$customerDoc.id",
            name: "$customerDoc.name",
            email: "$customerDoc.email",
            image: { $ifNull: ["$customerDoc.image", null] },
          },
          null,
        ],
      },
    },
  },
  { $project: { serviceDoc: 0, vendorDoc: 0, customerDoc: 0 } },
];

export async function createBooking(user, body) {
  if (user.role !== "customer") {
    throw ApiError.forbidden("Only customers can request bookings");
  }

  const payload = readBookingPayload(body);

  const serviceId = toObjectId(body?.serviceId, "Service not found");
  const services = getCollection("services");
  const service = await services.findOne({ _id: serviceId });

  if (!service) throw ApiError.notFound("Service not found");

  if (service.status !== "approved" || !service.availability) {
    throw ApiError.unprocessable("This service is not accepting bookings right now", [
      { field: "serviceId", message: "Only approved and available services can be booked" },
    ]);
  }

  if (service.vendorId === user.id) {
    throw ApiError.forbidden("You cannot book your own service");
  }

  const bookings = getCollection("bookings");
  const duplicate = await bookings.findOne({
    customerId: user.id,
    serviceId,
    eventDate: payload.eventDate,
    status: { $in: ACTIVE_STATUSES },
  });

  if (duplicate) {
    throw ApiError.conflict("You already have an active request for this service on that date");
  }

  const now = new Date();
  const document = {
    serviceId,
    vendorId: service.vendorId,
    customerId: user.id,
    eventDate: payload.eventDate,
    eventLocation: payload.eventLocation,
    message: payload.message,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const result = await bookings
    .insertOne(document)
    .catch((error) => {
      // A concurrent request can slip past the read check; the partial unique
      // index is the authoritative guard.
      if (error?.code === 11000) {
        throw ApiError.conflict("You already have an active request for this service on that date");
      }
      throw error;
    });

  return { ...document, _id: result.insertedId, service, vendor: null, customer: null };
}

/** Loads one booking and enforces who may see it. */
export async function getBookingForUser(user, id) {
  const bookings = getCollection("bookings");
  const [booking] = await bookings
    .aggregate([
      { $match: { _id: toObjectId(id) } },
      ...SERVICE_LOOKUP,
      ...USER_LOOKUPS,
      ...BOOKING_SHAPE,
    ])
    .toArray();

  if (!booking) throw ApiError.notFound("Booking not found");

  const isCustomer = booking.customerId === user.id;
  const isVendor = booking.vendorId === user.id;

  if (!isCustomer && !isVendor && user.role !== "admin") {
    throw ApiError.forbidden("You do not have access to this booking");
  }

  return booking;
}

async function listBookings({ filter, query, defaultLimit = 12 }) {
  const bookings = getCollection("bookings");
  const { page, limit, skip } = parsePagination(query, { defaultLimit, maxLimit: 50 });
  const status = optionalEnum(query.status, "status", BOOKING_STATUSES);

  const match = { ...filter };
  if (status) match.status = status;

  const [items, total] = await Promise.all([
    bookings
      .aggregate([
        { $match: match },
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        ...SERVICE_LOOKUP,
        ...USER_LOOKUPS,
        ...BOOKING_SHAPE,
      ])
      .toArray(),
    bookings.countDocuments(match),
  ]);

  return {
    items,
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function listCustomerBookings(user, query) {
  return listBookings({ filter: { customerId: user.id }, query });
}

export async function listVendorBookings(user, query) {
  return listBookings({ filter: { vendorId: user.id }, query });
}

/**
 * Cancellation is a customer decision and only possible while the request is
 * still waiting for the vendor. Accepted bookings are handled between the two
 * parties directly.
 */
export async function cancelBooking(user, id) {
  const bookings = getCollection("bookings");
  const booking = await bookings.findOne({ _id: toObjectId(id) });

  if (!booking) throw ApiError.notFound("Booking not found");

  if (booking.customerId !== user.id && user.role !== "admin") {
    throw ApiError.forbidden("You can only cancel your own bookings");
  }

  if (booking.status !== "pending") {
    throw ApiError.conflict("Only pending requests can be cancelled");
  }

  await bookings.updateOne(
    { _id: booking._id },
    { $set: { status: "cancelled", updatedAt: new Date() } }
  );

  return { ...booking, status: "cancelled", updatedAt: new Date() };
}

/** Vendors accept or reject a request; both are one-way transitions. */
export async function updateBookingStatus(user, id, body) {
  if (user.role !== "vendor" && user.role !== "admin") {
    throw ApiError.forbidden("Only vendors can respond to booking requests");
  }

  const nextStatus = optionalEnum(body?.status, "status", ["accepted", "rejected"]);
  if (!nextStatus) {
    throw ApiError.unprocessable("status must be accepted or rejected", [
      { field: "status", message: "status must be accepted or rejected" },
    ]);
  }

  const bookings = getCollection("bookings");
  const booking = await bookings.findOne({ _id: toObjectId(id) });

  if (!booking) throw ApiError.notFound("Booking not found");

  if (user.role !== "admin" && booking.vendorId !== user.id) {
    throw ApiError.forbidden("You can only respond to your own booking requests");
  }

  if (booking.status !== "pending") {
    throw ApiError.conflict("This request has already been handled");
  }

  const updatedAt = new Date();
  await bookings.updateOne({ _id: booking._id }, { $set: { status: nextStatus, updatedAt } });

  return { ...booking, status: nextStatus, updatedAt };
}
