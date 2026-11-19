import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

/**
 * Resolves the signed-in user for a request.
 *
 * Phase 7 keeps authentication in Next.js (Better Auth), so this middleware
 * asks the auth server to validate the forwarded session cookie. That keeps a
 * single source of truth for sessions and roles while the SQL-free business
 * endpoints stay closed to anonymous callers.
 *
 * Phase 10 replaces the body of `resolveUser` with local JWT/JWKS verification
 * and nothing else in the codebase has to change: every handler keeps reading
 * `req.user`.
 */
async function resolveUser(req) {
  if (!env.betterAuthUrl) {
    throw new ApiError(
      503,
      "Authentication is not configured on the server (BETTER_AUTH_URL is missing)"
    );
  }

  const cookie = req.headers.cookie;
  if (!cookie) {
    throw ApiError.unauthorized();
  }

  let response;
  try {
    response = await fetch(`${env.betterAuthUrl.replace(/\/$/, "")}/api/auth/get-session`, {
      method: "GET",
      headers: { cookie, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error("[auth] session lookup failed:", error.message);
    throw new ApiError(502, "Authentication service is unavailable. Please try again.");
  }

  if (!response.ok) {
    throw ApiError.unauthorized();
  }

  const payload = await response.json().catch(() => null);
  const user = payload?.user;

  if (!user?.id) {
    throw ApiError.unauthorized();
  }

  if (user.isBlocked) {
    throw ApiError.forbidden("This account has been blocked. Contact support for help.");
  }

  // A premium plan without a future expiry is not premium. Enforcing it here
  // means quota checks, badges and dashboards all see the same truth.
  const plan = user.subscriptionPlan === "premium" ? "premium" : "free";
  const expiresAt = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
  const premiumActive = plan === "premium" && expiresAt !== null && expiresAt.getTime() > Date.now();

  return {
    id: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role === "admin" || user.role === "vendor" ? user.role : "customer",
    image: user.image ?? null,
    businessName: user.businessName ?? null,
    subscriptionPlan: premiumActive ? "premium" : "free",
    subscriptionExpiresAt: premiumActive ? expiresAt.toISOString() : null,
  };
}

/** Attaches `req.user` or rejects the request. */
export async function requireAuth(req, res, next) {
  try {
    req.user = await resolveUser(req);
    next();
  } catch (error) {
    next(error);
  }
}

/** Must run after `requireAuth`. */
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
