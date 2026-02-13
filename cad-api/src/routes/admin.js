import express from 'express';
import { q } from '../lib/db.js';
import { requirePerm } from '../lib/permissions.js';
import { audit } from '../lib/audit.js';

const router = express.Router();

router.get('/users', requirePerm('ADMIN'), async (req, res) => {
  const qtext = (req.query.q || '').toString().trim();
  if (!qtext) return res.status(400).json({ error: 'missing_query' });

  const rows = await q(
    "SELECT discord_id, discord_name, avatar, disabled, created_at, last_login_at FROM irp_cad_users WHERE discord_id LIKE ? OR discord_name LIKE ? ORDER BY last_login_at DESC LIMIT 25",
    [`%${qtext}%`, `%${qtext}%`]
  );

  await audit(req, 'ADMIN_SEARCH_USERS', qtext, { count: rows.length });
  res.json({ results: rows });
});

router.get('/users/:discord_id/perms', requirePerm('ADMIN'), async (req, res) => {
  const id = req.params.discord_id;
  const rows = await q("SELECT perm_key, value, granted_by_discord_id, created_at FROM irp_cad_permissions WHERE discord_id = ? ORDER BY perm_key ASC", [id]);
  await audit(req, 'ADMIN_VIEW_PERMS', id, {});
  res.json({ results: rows });
});

router.post('/users/:discord_id/disable', requirePerm('ADMIN'), async (req, res) => {
  const id = req.params.discord_id;
  const disabled = req.body?.disabled ? 1 : 0;
  await q("UPDATE irp_cad_users SET disabled = ? WHERE discord_id = ?", [disabled, id]);
  await audit(req, 'ADMIN_SET_DISABLED', id, { disabled });
  res.json({ ok: true });
});

router.post('/users/:discord_id/perm', requirePerm('ADMIN'), async (req, res) => {
  const id = req.params.discord_id;
  const perm_key = String(req.body?.perm_key || '').trim();
  const value = req.body?.value ? 1 : 0;
  if (!perm_key) return res.status(400).json({ error: 'missing_fields' });

  await q(
    "INSERT INTO irp_cad_permissions (discord_id, perm_key, value, granted_by_discord_id) VALUES (?, ?, ?, ?) " +
    "ON DUPLICATE KEY UPDATE value=VALUES(value), granted_by_discord_id=VALUES(granted_by_discord_id), created_at=NOW()",
    [id, perm_key, value, req.user.discord_id]
  );

  await audit(req, 'ADMIN_SET_PERM', id, { perm_key, value });
  res.json({ ok: true });
});

router.get('/audit', requirePerm('ADMIN'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const rows = await q("SELECT id, discord_id, action, target, meta, ip, created_at FROM irp_cad_audit ORDER BY id DESC LIMIT ?", [limit]);
  res.json({ results: rows });
});

export default router;
