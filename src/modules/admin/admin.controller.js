import {
  adminStats,
  deleteService,
  getUserDetail,
  listServices,
  listTransactions,
  listUsers,
  setServiceStatus,
  setUserBlocked,
} from "./admin.service.js";

function paginated(res, result) {
  const { items, page, limit, total, totalPages } = result;
  res.json({ success: true, data: items, meta: { page, limit, total, totalPages } });
}

export async function stats(req, res) {
  res.json({ success: true, data: await adminStats() });
}

export async function users(req, res) {
  paginated(res, await listUsers(req.query));
}

export async function user(req, res) {
  res.json({ success: true, data: await getUserDetail(req.params.id) });
}

export async function blockUser(req, res) {
  const user = await setUserBlocked(req.user, req.params.id, req.body ?? {});
  res.json({ success: true, data: user });
}

export async function services(req, res) {
  paginated(res, await listServices(req.query));
}

export async function updateServiceStatus(req, res) {
  const service = await setServiceStatus(req.params.id, req.body ?? {});
  res.json({ success: true, data: service });
}

export async function removeService(req, res) {
  res.json({ success: true, data: await deleteService(req.params.id) });
}

export async function transactions(req, res) {
  paginated(res, await listTransactions(req.query));
}
