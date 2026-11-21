import {
  cancelBooking,
  createBooking,
  getBookingForUser,
  listCustomerBookings,
  listVendorBookings,
  updateBookingStatus,
} from "./booking.service.js";

export async function create(req, res) {
  const booking = await createBooking(req.user, req.body ?? {});
  res.status(201).json({ success: true, data: booking });
}

export async function mine(req, res) {
  const { items, page, limit, total, totalPages } = await listCustomerBookings(
    req.user,
    req.query
  );

  res.json({ success: true, data: items, meta: { page, limit, total, totalPages } });
}

export async function vendor(req, res) {
  const { items, page, limit, total, totalPages } = await listVendorBookings(
    req.user,
    req.query
  );

  res.json({ success: true, data: items, meta: { page, limit, total, totalPages } });
}

export async function show(req, res) {
  const booking = await getBookingForUser(req.user, req.params.id);
  res.json({ success: true, data: booking });
}

export async function cancel(req, res) {
  const booking = await cancelBooking(req.user, req.params.id);
  res.json({ success: true, data: booking });
}

export async function updateStatus(req, res) {
  const booking = await updateBookingStatus(req.user, req.params.id, req.body ?? {});
  res.json({ success: true, data: booking });
}
