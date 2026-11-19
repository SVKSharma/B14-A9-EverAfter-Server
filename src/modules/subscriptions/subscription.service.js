import { getCollection } from "../../config/db.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { createCheckoutSession, retrieveCheckoutSession } from "./stripe.client.js";

/** A premium pass is a single payment that unlocks a fixed window. */
export function premiumAmount() {
  return {
    amount: env.premiumPriceCents,
    currency: env.premiumCurrency,
    days: env.premiumDurationDays,
  };
}

/** Premium is only real while the expiry is in the future. */
export function isPremiumActive(user) {
  if (user.subscriptionPlan !== "premium") return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
}

/**
 * A vendor may only buy for themselves, and only while they are not already
 * covered by an active pass.
 */
export async function createVendorCheckout(user) {
  if (user.role !== "vendor") {
    throw ApiError.forbidden("Only vendors can subscribe to Premium");
  }

  if (isPremiumActive(user)) {
    throw ApiError.conflict("Your Premium plan is already active");
  }

  const { amount, currency, days } = premiumAmount();
  const [clientOrigin] = env.allowedOrigins;

  if (!clientOrigin) {
    throw new ApiError(503, "CLIENT_URL must be configured before payments can start");
  }

  const transactions = getCollection("transactions");
  const now = new Date();

  // The pending row is written first so the webhook always has a record to
  // reconcile, and so a lost redirect can still be matched by session id.
  const insert = await transactions.insertOne({
    vendorId: user.id,
    plan: "premium",
    amount,
    currency,
    stripeSessionId: `pending-${now.getTime()}-${user.id}`,
    stripeSubscriptionId: null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  let session;
  try {
    session = await createCheckoutSession({
      mode: "payment",
      success_url: `${clientOrigin}/dashboard/vendor/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientOrigin}/dashboard/vendor/subscription/cancel`,
      customer_email: user.email,
      client_reference_id: user.id,
      // Matched by the webhook; never trusted from the browser.
      metadata: {
        vendorId: user.id,
        transactionId: String(insert.insertedId),
        days,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: {
              name: "EverAfter Premium",
              description: `Unlimited services and a premium badge for ${days} days`,
            },
          },
        },
      ],
    });
  } catch (error) {
    await transactions.deleteOne({ _id: insert.insertedId });
    throw error;
  }

  await transactions.updateOne(
    { _id: insert.insertedId },
    {
      $set: {
        stripeSessionId: session.id,
        checkoutUrl: session.url,
        updatedAt: new Date(),
      },
    }
  );

  return { url: session.url, sessionId: session.id, amount, currency, days };
}

/** Plan, expiry and the most recent payment for the subscription page. */
export async function getSubscriptionStatus(user) {
  const users = getCollection("users");
  const transactions = getCollection("transactions");

  // Re-read the plan from Mongo so an expiry that passed while a session was
  // open is reflected immediately.
  const record = await users.findOne({ id: user.id });
  const expiresAt = record?.subscriptionExpiresAt ? new Date(record.subscriptionExpiresAt) : null;
  const active = record?.subscriptionPlan === "premium" && expiresAt && expiresAt.getTime() > Date.now();

  if (record?.subscriptionPlan === "premium" && !active) {
    await users.updateOne(
      { _id: record._id },
      { $set: { subscriptionPlan: "free", subscriptionExpiresAt: null, updatedAt: new Date() } }
    );
  }

  const latest = await transactions.findOne(
    { vendorId: user.id },
    { sort: { createdAt: -1 } }
  );

  const { amount, currency, days } = premiumAmount();

  return {
    plan: active ? "premium" : "free",
    expiresAt: active ? expiresAt.toISOString() : null,
    price: { amount, currency, days },
    latestTransaction: latest
      ? {
          id: String(latest._id),
          status: latest.status,
          amount: latest.amount,
          currency: latest.currency,
          createdAt: latest.createdAt,
        }
      : null,
  };
}

/**
 * Confirms a returning customer's session for the success page. This reads
 * from Stripe directly, but deliberately does not activate anything: the
 * webhook remains the only writer of plan state.
 */
export async function describeCheckoutSession(sessionId) {
  if (!sessionId) {
    throw ApiError.badRequest("A session id is required");
  }

  const session = await retrieveCheckoutSession(sessionId);

  return {
    id: session.id,
    status: session.status,
    paymentStatus: session.payment_status,
    amount: session.amount_total ?? null,
    currency: session.currency ?? null,
  };
}

/**
 * Applies a verified `checkout.session.completed` event.
 * Idempotent: replayed deliveries find the transaction already `success` and
 * return without extending the pass again.
 */
export async function activatePremiumFromSession(session) {
  const transactions = getCollection("transactions");
  const users = getCollection("users");

  if (session.payment_status !== "paid") {
    return { activated: false, reason: "not-paid" };
  }

  const transaction = await transactions.findOne({ stripeSessionId: session.id });

  if (!transaction) {
    console.error("[stripe] webhook for unknown session:", session.id);
    return { activated: false, reason: "unknown-session" };
  }

  if (transaction.status === "success") {
    return { activated: false, reason: "already-processed" };
  }

  const vendorId = transaction.vendorId;
  const user = await users.findOne({ id: vendorId });

  if (!user) {
    console.error("[stripe] session belongs to a missing user:", vendorId);
    return { activated: false, reason: "unknown-vendor" };
  }

  const days = Number(session.metadata?.days) || env.premiumDurationDays;
  const now = new Date();

  // Renewals stack on top of an unexpired window rather than truncating it.
  const currentExpiry =
    user.subscriptionPlan === "premium" && user.subscriptionExpiresAt
      ? new Date(user.subscriptionExpiresAt).getTime()
      : 0;
  const base = Math.max(currentExpiry, now.getTime());
  const expiresAt = new Date(base + days * 24 * 60 * 60 * 1000);

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: expiresAt,
        updatedAt: now,
      },
    }
  );

  await transactions.updateOne(
    { _id: transaction._id },
    {
      $set: {
        status: "success",
        amount: session.amount_total ?? transaction.amount,
        currency: session.currency ?? transaction.currency,
        paidAt: now,
        updatedAt: now,
      },
    }
  );

  return { activated: true, expiresAt };
}

/** Records a failed or expired checkout so the transaction list stays honest. */
export async function markSessionFailed(session, status = "failed") {
  const transactions = getCollection("transactions");
  const transaction = await transactions.findOne({ stripeSessionId: session.id });

  if (!transaction || transaction.status === "success") return false;

  await transactions.updateOne(
    { _id: transaction._id },
    { $set: { status, updatedAt: new Date() } }
  );

  return true;
}
