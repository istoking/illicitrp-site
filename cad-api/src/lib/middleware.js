import { getAuthCookie, verifyToken } from './auth.js';
import { q } from './db.js';
import { resolvePermissions } from './permissions.js';
import { getGuildRoles, getMemberRoles } from './discord.js';

export async function authMiddleware(req, res, next) {
  const token = getAuthCookie(req);
  if (!token) return next();

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (e) {
    return next();
  }
}

export async function requireAuth(req, res, next) {
  if (!req.user || !req.user.discord_id) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// Loads latest role names + permissions for each request (safe, but can be cached)
export async function loadPermissions(req, res, next) {
  if (!req.user || !req.user.discord_id) return next();

  try {
    const discordId = req.user.discord_id;

    const roleIds = await getMemberRoles(discordId);
    const guildRoles = await getGuildRoles();
    const roleNames = roleIds
      .map((rid) => guildRoles.find((r) => r.id === rid))
      .filter(Boolean)
      .map((r) => r.name);

    // Upsert user record (and check disabled)
    await q(
      'INSERT INTO irp_cad_users (discord_id, discord_name, avatar, last_login_at) VALUES (?, ?, ?, NOW()) ' +
      'ON DUPLICATE KEY UPDATE discord_name=VALUES(discord_name), avatar=VALUES(avatar), last_login_at=NOW()',
      [discordId, req.user.discord_name || null, req.user.avatar || null]
    );

    const users = await q('SELECT disabled FROM irp_cad_users WHERE discord_id = ? LIMIT 1', [discordId]);
    if (users[0] && users[0].disabled === 1) {
      return res.status(403).json({ error: 'account_disabled' });
    }

    const { perms, groups } = await resolvePermissions({ discordId, roleIds, roleNames });

    req.user.role_ids = roleIds;
    req.user.role_names = roleNames;
    req.user.groups = groups;
    req.user.perms = perms;

    next();
  } catch (e) {
    // If Discord fetch fails, keep token but deny perms
    req.user.perms = {};
    next();
  }
}
