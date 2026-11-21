import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

const STRIPE_API = "https://api.stripe.com/v1";

/**
 * Minimal Stripe REST client.
 *
 * The project's fixed dependency list has no Stripe SDK, and Checkout only
 * needs two calls, so plain `fetch` with form encoding keeps the server lean
 * and auditable.
 */
function requireKey() {
  if (!env.stripeSecretKey) {
    throw new ApiError(503, "Payments are not configured on the server (STRIPE_SECRET_KEY is missing)");
  }
  return env.stripeSecretKey;
}

/** Stripe expects bracketed form keys, e.g. `line_items[0][quantity]=1`. */
function encodeForm(payload, prefix, target) {
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;

    const name = prefix ? `${prefix}[${key}]` : key;

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item !== null && typeof item === "object") {
          encodeForm(item, `${name}[${index}]`, target);
        } else if (item !== undefined && item !== null) {
          target.append(`${name}[${index}]`, String(item));
        }
      });
    } else if (typeof value === "object") {
      encodeForm(value, name, target);
    } else {
      target.append(name, String(value));
    }
  }
}

async function stripeRequest(path, { method = "POST", body } = {}) {
  const key = requireKey();
  const params = new URLSearchParams();
  if (body) encodeForm(body, "", params);

  let response;
  try {
    response = await fetch(`${STRIPE_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
      },
      body: method === "GET" ? undefined : params.toString(),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    console.error("[stripe] request failed:", error.message);
    throw new ApiError(502, "Stripe could not be reached. Please try again.");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message ?? `Stripe returned ${response.status}`;
    console.error("[stripe] error:", response.status, message);
    throw new ApiError(502, `Payment provider error: ${message}`);
  }

  return payload;
}

export function createCheckoutSession(payload) {
  return stripeRequest("/checkout/sessions", { method: "POST", body: payload });
}

export function retrieveCheckoutSession(id) {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(id)}`, { method: "GET" });
}

/**
 * Closes an abandoned Checkout session. Used when a pending transaction is
 * being released, so the old payment link cannot still be paid afterwards and
 * produce a second charge for the same pass.
 */
export function expireCheckoutSession(id) {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(id)}/expire`, { method: "POST" });
}

/**
 * Verifies a Stripe webhook signature against the exact raw request body.
 * Uses a timing-safe comparison and rejects stale timestamps so a replayed
 * delivery cannot be accepted later.
 */
export function verifyWebhookSignature({ rawBody, signatureHeader, secret, toleranceSeconds = 300 }) {
  if (!secret) {
    throw new ApiError(503, "Webhook secret is not configured (STRIPE_WEBHOOK_SECRET)");
  }

  if (typeof signatureHeader !== "string" || signatureHeader.trim() === "") {
    throw ApiError.badRequest("Missing Stripe-Signature header");
  }

  const parts = signatureHeader.split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    if (!key || !value) return acc;
    if (key === "t") acc.timestamp = value;
    if (key === "v1") acc.signatures.push(value);
    return acc;
  }, { timestamp: null, signatures: [] });

  if (!parts.timestamp || parts.signatures.length === 0) {
    throw ApiError.badRequest("Malformed Stripe-Signature header");
  }

  const timestamp = Number(parts.timestamp);
  if (!Number.isFinite(timestamp)) {
    throw ApiError.badRequest("Malformed Stripe signature timestamp");
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > toleranceSeconds) {
    throw ApiError.badRequest("Stripe signature has expired");
  }

  const signedPayload = `${parts.timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const matches = parts.signatures.some((signature) => {
    const provided = Buffer.from(signature, "hex");
    return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
  });

  if (!matches) {
    throw ApiError.badRequest("Invalid Stripe signature");
  }

  return true;
}

