import { env } from "../../config/env.js";
import { verifyWebhookSignature } from "./stripe.client.js";
import { activatePremiumFromSession, markSessionFailed } from "./subscription.service.js";

/**
 * Stripe webhook. Mounted with `express.raw` before the JSON parser because the
 * signature covers the exact bytes Stripe sent.
 *
 * Only verified `checkout.session.completed` (paid) and
 * `checkout.session.expired` events mutate state. Delivery is acknowledged with
 * 200 even for ignored event types so Stripe stops retrying.
 */
export async function stripeWebhook(req, res, next) {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

    verifyWebhookSignature({
      rawBody,
      signatureHeader: req.headers["stripe-signature"],
      secret: env.stripeWebhookSecret,
    });

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid webhook payload" });
    }

    const session = event?.data?.object;

    switch (event?.type) {
      case "checkout.session.completed":
        if (session?.id) {
          await activatePremiumFromSession(session);
        }
        break;

      case "checkout.session.expired":
        if (session?.id) {
          await markSessionFailed(session, "expired");
        }
        break;

      case "checkout.session.async_payment_failed":
        if (session?.id) {
          await markSessionFailed(session, "failed");
        }
        break;

      default:
        // Unhandled types are acknowledged without touching data.
        break;
    }

    res.json({ success: true, received: true });
  } catch (error) {
    next(error);
  }
}
