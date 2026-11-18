import { ObjectId } from "mongodb";
import { ApiError } from "./api-error.js";

export function fail(field, message) {
  throw ApiError.unprocessable(message || `Invalid value for ${field}`, [{ field, message }]);
}

export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireObject(value, field = "body") {
  if (!isPlainObject(value)) {
    fail(field, `${field} must be an object`);
  }
  return value;
}

export function requireString(value, field, { min = 1, max = 2000 } = {}) {
  if (typeof value !== "string") fail(field, `${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length < min) fail(field, `${field} must be at least ${min} characters`);
  if (trimmed.length > max) fail(field, `${field} must be at most ${max} characters`);
  return trimmed;
}

export function optionalString(value, field, { min = 0, max = 2000 } = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") fail(field, `${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed === "" && min === 0) return undefined;
  if (trimmed.length < min) fail(field, `${field} must be at least ${min} characters`);
  if (trimmed.length > max) fail(field, `${field} must be at most ${max} characters`);
  return trimmed;
}

export function requireNumber(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || Number.isNaN(number) || !Number.isFinite(number)) {
    fail(field, `${field} must be a valid number`);
  }
  if (integer && !Number.isInteger(number)) fail(field, `${field} must be a whole number`);
  if (number < min) fail(field, `${field} must be at least ${min}`);
  if (number > max) fail(field, `${field} must be at most ${max}`);
  return number;
}

export function requireEnum(value, field, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    fail(field, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

export function optionalEnum(value, field, allowed) {
  if (value === undefined || value === null || value === "") return undefined;
  return requireEnum(value, field, allowed);
}

export function requireBoolean(value, field) {
  if (typeof value !== "boolean") fail(field, `${field} must be true or false`);
  return value;
}

export function requireArray(value, field, { min = 0, max = 20 } = {}) {
  if (!Array.isArray(value)) fail(field, `${field} must be an array`);
  if (value.length < min) fail(field, `${field} must contain at least ${min} item(s)`);
  if (value.length > max) fail(field, `${field} must contain at most ${max} item(s)`);
  return value;
}

export function requireDate(value, field, { future = false } = {}) {
  if (typeof value !== "string" && !(value instanceof Date)) {
    fail(field, `${field} must be a valid date`);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail(field, `${field} must be a valid date`);
  if (future) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (date < startOfToday) fail(field, `${field} must be today or a future date`);
  }
  return date;
}

export function requireUrl(value, field) {
  const raw = requireString(value, field, { max: 2048 });
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid protocol");
    return url.toString();
  } catch {
    fail(field, `${field} must be a valid http(s) URL`);
  }
}

export function requireObjectId(value, field) {
  if (!ObjectId.isValid(value)) fail(field, `${field} is not a valid id`);
  return new ObjectId(value);
}

export function requireEmail(value, field = "email") {
  const email = requireString(value, field, { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(field, `${field} must be a valid email address`);
  return email;
}

export function parsePagination(query, { defaultLimit = 12, maxLimit = 50 } = {}) {
  const page = query.page === undefined ? 1 : requireNumber(query.page, "page", { min: 1, integer: true });
  const limit =
    query.limit === undefined
      ? defaultLimit
      : requireNumber(query.limit, "limit", { min: 1, max: maxLimit, integer: true });
  return { page, limit, skip: (page - 1) * limit };
}
