import {
  createService,
  deleteService,
  getManageableService,
  listVendorServices,
  setAvailability,
  updateService,
} from "./vendor-service.service.js";

export async function myServices(req, res) {
  const { items, page, limit, total, totalPages, quota } = await listVendorServices(
    req.user,
    req.query
  );

  res.json({
    success: true,
    data: items,
    meta: { page, limit, total, totalPages, quota },
  });
}

export async function myService(req, res) {
  const service = await getManageableService(req.user, req.params.id);
  res.json({ success: true, data: service });
}

export async function create(req, res) {
  const service = await createService(req.user, req.body);
  res.status(201).json({ success: true, data: service });
}

export async function update(req, res) {
  const service = await updateService(req.user, req.params.id, req.body);
  res.json({ success: true, data: service });
}

export async function toggleAvailability(req, res) {
  const service = await setAvailability(req.user, req.params.id, req.body);
  res.json({ success: true, data: service });
}

export async function remove(req, res) {
  const result = await deleteService(req.user, req.params.id);
  res.json({ success: true, data: result });
}
