import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { getCollection } from "../config/db.js";
import { ApiError } from "../utils/api-error.js";

const authOrigin = (env.betterAuthUrl || "").replace(/\/$/, "");

let jwks = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${authOrigin}/api/auth/jwks`));
  }
  return jwks;
}

function readToken(req) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

async function findUser(id) {
  const user = await getCollection("users").findOne({ id });
  if (user) return user;
  if (!ObjectId.isValid(id)) return null;
  return getCollection("users").findOne({ _id: new ObjectId(id) });
}

async function resolveUser(req) {
  if (!authOrigin) {
    throw new ApiError(503, "Authentication is not configured on the server");
  }

  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    ({ payload } = await jwtVerify(token, getJwks(), {
      issuer: env.jwtIssuer || authOrigin,
      audience: env.jwtAudience || authOrigin,
    }));
  } catch {
    throw ApiError.unauthorized("Your session is invalid or has expired. Please sign in again.");
  }

  if (!payload.sub) throw ApiError.unauthorized();

  const user = await findUser(String(payload.sub));
  if (!user) throw ApiError.unauthorized("Your account no longer exists");
  if (user.isBlocked) {
    throw ApiError.forbidden("This account has been blocked. Contact support for help.");
  }

  const expiresAt = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
  const premium =
    user.subscriptionPlan === "premium" && expiresAt !== null && expiresAt.getTime() > Date.now();

  return {
    id: String(user.id || user._id),
    email: user.email,
    name: user.name,
    role: user.role === "admin" || user.role === "vendor" ? user.role : "customer",
    image: user.image ?? null,
    businessName: user.businessName ?? null,
    subscriptionPlan: premium ? "premium" : "free",
    subscriptionExpiresAt: premium ? expiresAt.toISOString() : null,
  };
}

export async function requireAuth(req, res, next) {
  try {
    req.user = await resolveUser(req);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }

    return next();
  };
}
