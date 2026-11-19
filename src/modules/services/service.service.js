import { getCollection } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import {
  optionalEnum,
  optionalString,
  parsePagination,
  requireNumber,
} from "../../utils/validation.js";
import { CATEGORIES, SERVICE_SORT_OPTIONS } from "../../utils/constants.js";
import { ObjectId } from "mongodb";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function optionalPrice(value, field) {
  if (value === undefined || value === null || value === "") return undefined;
  return requireNumber(value, field, { min: 0 });
}

function buildFilter(query) {
  const search = optionalString(query.search, "search", { max: 100 });
  const location = optionalString(query.location, "location", { max: 120 });
  const category = optionalEnum(query.category, "category", CATEGORIES);
  const minPrice = optionalPrice(query.minPrice, "minPrice");
  const maxPrice = optionalPrice(query.maxPrice, "maxPrice");

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw ApiError.unprocessable("minPrice cannot be greater than maxPrice", [
      { field: "minPrice", message: "minPrice cannot be greater than maxPrice" },
    ]);
  }

  const filter = { status: "approved", availability: true };

  if (category) filter.category = category;

  if (location) {
    filter.location = { $regex: escapeRegex(location), $options: "i" };
  }

  if (search) {
    const pattern = escapeRegex(search);
    filter.$or = [
      { serviceName: { $regex: pattern, $options: "i" } },
      { description: { $regex: pattern, $options: "i" } },
    ];
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }

  return filter;
}

function buildSort(sort) {
  // Premium vendors are featured first on every ordering; the requested sort
  // breaks ties inside each group.
  const rank = { _premiumRank: -1 };
  if (sort === "price_asc") return { ...rank, price: 1, createdAt: -1, _id: -1 };
  if (sort === "price_desc") return { ...rank, price: -1, createdAt: -1, _id: -1 };
  return { ...rank, createdAt: -1, _id: -1 };
}

const VENDOR_LOOKUP_STAGES = [
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
      // A premium plan whose expiry already passed is not premium, so the
      // ranking reads the expiry rather than trusting the stored plan.
      _premiumRank: {
        $cond: [
          {
            $and: [
              { $eq: ["$vendorDoc.subscriptionPlan", "premium"] },
              { $gt: ["$vendorDoc.subscriptionExpiresAt", "$$NOW"] },
            ],
          },
          1,
          0,
        ],
      },
    },
  },
  {
    $addFields: {
      vendor: {
        $cond: [
          { $ifNull: ["$vendorDoc", false] },
          {
            id: "$vendorDoc.id",
            name: "$vendorDoc.name",
            businessName: "$vendorDoc.businessName",
            image: "$vendorDoc.image",
            subscriptionPlan: {
              $cond: [{ $eq: ["$_premiumRank", 1] }, "premium", "free"],
            },
          },
          null,
        ],
      },
    },
  },
];

export async function listServices(query) {
  const services = getCollection("services");
  const filter = buildFilter(query);
  const sort = optionalEnum(query.sort, "sort", SERVICE_SORT_OPTIONS) ?? "newest";
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 9, maxLimit: 48 });

  const [items, total] = await Promise.all([
    services
      .aggregate([
        { $match: filter },
        // Ranking needs the joined vendor, so pagination happens after lookup.
        ...VENDOR_LOOKUP_STAGES,
        { $sort: buildSort(sort) },
        { $skip: skip },
        { $limit: limit },
        { $project: { vendorDoc: 0, _premiumRank: 0 } },
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

export async function getPublicServiceById(id) {
  if (!ObjectId.isValid(id)) {
    throw ApiError.notFound("Service not found");
  }

  const services = getCollection("services");
  const [service] = await services
    .aggregate([
      {
        $match: {
          _id: new ObjectId(id),
          status: "approved",
          availability: true,
        },
      },
      ...VENDOR_LOOKUP_STAGES,
      { $project: { vendorDoc: 0, _premiumRank: 0 } },
    ])
    .toArray();

  if (!service) {
    throw ApiError.notFound("This service is not available or is no longer published");
  }

  return service;
}
