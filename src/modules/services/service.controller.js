import { getPublicServiceById, listServices } from "./service.service.js";

export async function index(req, res) {
  const { items, page, limit, total, totalPages } = await listServices(req.query);

  res.json({
    success: true,
    data: items,
    meta: { page, limit, total, totalPages },
  });
}

export async function show(req, res) {
  const service = await getPublicServiceById(req.params.id);

  res.json({ success: true, data: service });
}
