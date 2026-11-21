import { getCollection } from "../../config/db.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { createCheckoutSession, expireCheckoutSession, retrieveCheckoutSession } from "./stripe.client.js";

/** A premium pass is a single payment that unlocks a fixed window. */
export function premiumAmount() {
  return {
    amount: env.premiumPriceCents,
    currency: env.premiumCurrency,
    days: env.premiumDurationDays,
  };
}

/**
 * How long an unfinished checkout blocks a second one. Stripe confirms a paid
 * session within seconds, so anything older is almost always an abandoned
 * attempt: it is closed and released so the vendor can try again.
 */
const PENDING_CHECKOUT_TTL_MS = 15 * 60 * 1000;

/**
 * Resolves one pending row against Stripe before releasing it.
 *
 * The order matters: a row is only released after Stripe confirms no money
 * moved and the session has been closed, so the vendor can never pay an
 * "expired" link and be charged twice. If Stripe cannot be reached, the row is
 * left alone rather than guessed at.
 *
 * Returns "released" (row is now `expired`), "paid" (money moved, webhook
 * missed — nothing is touched) or "keep" (undecidable, try next time).
 */
async function resolvePendingCheckout(transaction) {
  const transactions = getCollection("transactions");

  const release = async () => {
    await transactions.updateOne(
      { _id: transaction._id },
      { $set: { status: "expired", updatedAt: new Date() } }
    );
    return "released";
  };

  // The row never reached Stripe, so no link exists that could be paid.
  if (!transaction.stripeSessionId || transaction.stripeSessionId.startsWith("pending-")) {
    return release();
  }

  let session;
  try {
    session = await retrieveCheckoutSession(transaction.stripeSessionId);
  } catch {
    return "keep";
  }

  if (session.payment_status === "paid") {
    // Stripe took the money but the webhook never arrived. Releasing this row
    // would tell the vendor it is safe to pay again, so leave it pending and
    // make the missed delivery loud in the logs. Only a verified webhook is
    // allowed to grant the plan.
    console.error(
      "[stripe] paid session with no webhook delivery:",
      session.id,
      "| vendor:",
      transaction.vendorId
    );
    return "paid";
  }

  // Close the session first: after this the old checkout URL cannot be paid.
  if (session.status === "open") {
    try {
      await expireCheckoutSession(session.id);
    } catch {
      return "keep";
    }
  }

  return release();
}

/** Marks abandoned checkouts as expired so they stop blocking new ones. */
async function expireStaleCheckouts(vendorId) {
  const transactions = getCollection("transactions");
  const cutoff = new Date(Date.now() - PENDING_CHECKOUT_TTL_MS);

  const stale = await transactions
    .find({ vendorId, status: "pending", createdAt: { $lt: cutoff } })
    .toArray();

  for (const transaction of stale) {
    await resolvePendingCheckout(transaction);
  }
}

/** The newest pending checkout, if it is still inside the lock window. */
async function findBlockingCheckout(vendorId) {
  const transactions = getCollection("transactions");

  // Resolve first, so an abandoned attempt is not mistaken for a live one.
  await expireStaleCheckouts(vendorId);

  return transactions.findOne({ vendorId, status: "pending" });
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

  // Refuses a second live checkout: two open sessions for one vendor is how a
  // double charge happens. Abandoned rows are resolved against Stripe inside.
  const blocking = await findBlockingCheckout(user.id);
  if (blocking) {
    throw ApiError.conflict(
      "A payment is already in progress. Please wait for Stripe to confirm it before trying again."
    );
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

  // Stale checkouts are marked expired here too, so the page never shows a
  // "pending" row for a session that will never be confirmed.
  await expireStaleCheckouts(user.id);

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

  // A pending row can mean two very different things: the checkout is still
  // open, or the vendor paid and the webhook never arrived. Asking Stripe keeps
  // the page honest — in the second case it must not invite another payment.
  let awaitingActivation = false;
  if (latest?.status === "pending" && latest.stripeSessionId && !latest.stripeSessionId.startsWith("pending-")) {
    try {
      const session = await retrieveCheckoutSession(latest.stripeSessionId);
      awaitingActivation = session.payment_status === "paid";
    } catch {
      // Stripe unreachable: leave the flag off and keep the normal pending copy.
    }
  }

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
          awaitingActivation,
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
