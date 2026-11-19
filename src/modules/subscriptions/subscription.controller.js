import {
  createVendorCheckout,
  describeCheckoutSession,
  getSubscriptionStatus,
} from "./subscription.service.js";

export async function status(req, res) {
  const data = await getSubscriptionStatus(req.user);
  res.json({ success: true, data });
}

export async function checkout(req, res) {
  const data = await createVendorCheckout(req.user);
  res.status(201).json({ success: true, data });
}

export async function session(req, res) {
  const data = await describeCheckoutSession(req.query.session_id);
  res.json({ success: true, data });
}
