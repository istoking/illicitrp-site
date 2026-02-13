import rolesConfig from '../config/roles.json' assert { type: 'json' };
import { q } from './db.js';

export async function resolvePermissions({ discordId, roleIds = [], roleNames = [] }) {
  // Base perms from config
  const base = {};
  for (const [k, v] of Object.entries(rolesConfig.permissions)) base[k] = Boolean(v.default);

  // Apply group grants based on role matches (id or name)
  const grants = rolesConfig.grants || {};
  const groups = rolesConfig.groups || {};

  const matchedGroups = new Set();

  for (const [group, def] of Object.entries(groups)) {
    const match = def.match || [];
    for (const m of match) {
      if (m.type === 'id' && roleIds.includes(m.value)) matchedGroups.add(group);
      if (m.type === 'name' && roleNames.includes(m.value)) matchedGroups.add(group);
    }
  }

  for (const g of matchedGroups) {
    const perms = grants[g] || [];
    for (const p of perms) base[p] = true;
  }

  // Apply per-user overrides from DB (grant/revoke)
  const overrides = await q(
    'SELECT perm_key, value FROM irp_cad_permissions WHERE discord_id = ?',
    [discordId]
  );

  for (const row of overrides) base[row.perm_key] = row.value === 1;

  return { perms: base, groups: Array.from(matchedGroups) };
}

export function requirePerm(permKey) {
  return (req, res, next) => {
    if (!req.user || !req.user.perms || req.user.perms[permKey] !== true) {
      return res.status(403).json({ error: 'forbidden', perm: permKey });
    }
    next();
  };
}
