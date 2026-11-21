import { getMe, updateMe } from "./user.service.js";

export async function me(req, res) {
  res.json({ success: true, data: await getMe(req.user.id) });
}

export async function updateCurrentUser(req, res) {
  const user = await updateMe(req.user.id, req.body ?? {});
  res.json({ success: true, data: user });
}
