import { MongoServerError } from "mongodb";
import { ApiError } from "../utils/api-error.js";
import { env } from "../config/env.js";

export function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let statusCode = 500;
  let message = "Something went wrong. Please try again.";
  let errors;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    errors = error.errors;
  } else if (error instanceof MongoServerError && error.code === 11000) {
    statusCode = 409;
    message = "A record with these details already exists.";
  } else if (error.type === "entity.too.large") {
    statusCode = 413;
    message = "Request body is too large.";
  } else if (error instanceof SyntaxError && error.status === 400) {
    statusCode = 400;
    message = "Invalid JSON body.";
  }

  if (statusCode >= 500) {
    console.error(`[api] ${req.method} ${req.originalUrl} -> ${statusCode}`, error);
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;
  if (statusCode >= 500 && !env.isProduction) body.stack = error.stack;

  res.status(statusCode).json(body);
}
