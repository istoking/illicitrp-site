import { q } from './db.js';

export async function audit(req, action, target = null, meta = null) {
  try {
    const discordId = req.user?.discord_id || 'unknown';
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
    const metaJson = meta ? JSON.stringify(meta) : null;

    await q(
      'INSERT INTO irp_cad_audit (discord_id, action, target, meta, ip) VALUES (?, ?, ?, ?, ?)',
      [discordId, action, target, metaJson, ip]
    );
  } catch (e) {
    // Never fail requests due to audit logging
  }
}
