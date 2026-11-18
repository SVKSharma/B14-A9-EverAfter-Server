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
  if (sort === "price_asc") return { price: 1, createdAt: -1 };
  if (sort === "price_desc") return { price: -1, createdAt: -1 };
  return { createdAt: -1, _id: -1 };
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
      vendor: {
        $cond: [
          { $ifNull: ["$vendorDoc", false] },
          {
            id: "$vendorDoc.id",
            name: "$vendorDoc.name",
            businessName: "$vendorDoc.businessName",
            image: "$vendorDoc.image",
            subscriptionPlan: "$vendorDoc.subscriptionPlan",
          },
          null,
        ],
      },
    },
  },
  { $project: { vendorDoc: 0 } },
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
        { $sort: buildSort(sort) },
        { $skip: skip },
        { $limit: limit },
        ...VENDOR_LOOKUP_STAGES,
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
    ])
    .toArray();

  if (!service) {
    throw ApiError.notFound("This service is not available or is no longer published");
  }

  return service;
}
