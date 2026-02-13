import express from 'express';
import { q } from '../lib/db.js';
import { requirePerm } from '../lib/permissions.js';
import { audit } from '../lib/audit.js';

const router = express.Router();

// Citizens (QBCore players table)
router.get('/citizens', requirePerm('VIEW_CITIZENS'), async (req, res) => {
  const name = (req.query.name || '').toString().trim();
  const citizenid = (req.query.citizenid || '').toString().trim();

  let rows = [];
  if (citizenid) {
    rows = await q('SELECT citizenid, charinfo, job, gang, metadata FROM players WHERE citizenid = ? LIMIT 1', [citizenid]);
  } else if (name) {
    // charinfo is JSON stored as text in most qb setups
    rows = await q(
      "SELECT citizenid, charinfo, job, gang, metadata FROM players WHERE charinfo LIKE ? LIMIT 25",
      [`%"firstname":"${name}%`]
    );
  } else {
    return res.status(400).json({ error: 'missing_query' });
  }

  await audit(req, 'SEARCH_CITIZEN', citizenid || name, { count: rows.length });

  res.json({ results: rows.map(normalizeCitizen) });
});

router.get('/citizens/:citizenid', requirePerm('VIEW_CITIZENS'), async (req, res) => {
  const citizenid = req.params.citizenid;
  const rows = await q('SELECT citizenid, charinfo, job, gang, metadata FROM players WHERE citizenid = ? LIMIT 1', [citizenid]);
  await audit(req, 'VIEW_CITIZEN', citizenid, {});
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json({ citizen: normalizeCitizen(rows[0]) });
});

// Vehicles
router.get('/vehicles', requirePerm('VIEW_VEHICLES'), async (req, res) => {
  const plate = (req.query.plate || '').toString().trim();
  const citizenid = (req.query.citizenid || '').toString().trim();

  if (!plate && !citizenid) return res.status(400).json({ error: 'missing_query' });

  let rows = [];
  if (plate) {
    rows = await q('SELECT id, citizenid, plate, vehicle, state, garage, mods FROM player_vehicles WHERE plate = ? LIMIT 10', [plate]);
  } else {
    rows = await q('SELECT id, citizenid, plate, vehicle, state, garage, mods FROM player_vehicles WHERE citizenid = ? LIMIT 50', [citizenid]);
  }

  // Join ps-mdt vehicle flags
  const plates = rows.map((r) => r.plate).filter(Boolean);
  let flagsByPlate = {};
  if (plates.length) {
    const flags = await q(`SELECT plate, stolen, code5, points, information, image FROM mdt_vehicleinfo WHERE plate IN (${plates.map(()=>'?').join(',')})`, plates);
    for (const f of flags) flagsByPlate[f.plate] = f;
  }

  await audit(req, 'SEARCH_VEHICLE', plate || citizenid, { count: rows.length });

  res.json({
    results: rows.map((r) => ({
      ...r,
      flags: flagsByPlate[r.plate] || null,
    })),
  });
});

// Properties (qb-houses)
router.get('/properties', requirePerm('VIEW_PROPERTIES'), async (req, res) => {
  const citizenid = (req.query.citizenid || '').toString().trim();
  const house = (req.query.house || '').toString().trim();

  if (!citizenid && !house) return res.status(400).json({ error: 'missing_query' });

  let rows = [];
  if (house) {
    rows = await q(
      'SELECT ph.house, ph.citizenid, ph.identifier, ph.keyholders, hl.label, hl.coords, hl.owned, hl.price, hl.tier, hl.garage ' +
      'FROM player_houses ph LEFT JOIN houselocations hl ON hl.name = ph.house WHERE ph.house = ? LIMIT 20',
      [house]
    );
  } else {
    rows = await q(
      'SELECT ph.house, ph.citizenid, ph.identifier, ph.keyholders, hl.label, hl.coords, hl.owned, hl.price, hl.tier, hl.garage ' +
      'FROM player_houses ph LEFT JOIN houselocations hl ON hl.name = ph.house WHERE ph.citizenid = ? LIMIT 50',
      [citizenid]
    );
  }

  await audit(req, 'SEARCH_PROPERTY', house || citizenid, { count: rows.length });
  res.json({ results: rows });
});

// Warrants (ps-mdt convictions)
router.get('/warrants', requirePerm('VIEW_WARRANTS'), async (req, res) => {
  const citizenid = (req.query.citizenid || '').toString().trim();
  if (!citizenid) return res.status(400).json({ error: 'missing_query' });

  // ps-mdt uses 'cid' which often equals citizenid
  const rows = await q(
    "SELECT id, cid, linkedincident, warrant, guilty, processed, associated, charges, fine, sentence, time " +
    "FROM mdt_convictions WHERE cid = ? AND (warrant IN ('1','true','TRUE','yes','YES')) ORDER BY id DESC LIMIT 50",
    [citizenid]
  );

  await audit(req, 'VIEW_WARRANTS', citizenid, { count: rows.length });
  res.json({ results: rows });
});

// Reports (ps-mdt)
router.get('/reports', requirePerm('VIEW_REPORTS'), async (req, res) => {
  const qtext = (req.query.q || '').toString().trim();
  if (!qtext) return res.status(400).json({ error: 'missing_query' });

  const rows = await q(
    "SELECT id, author, title, type, time, jobtype FROM mdt_reports WHERE title LIKE ? OR author LIKE ? ORDER BY id DESC LIMIT 50",
    [`%${qtext}%`, `%${qtext}%`]
  );

  await audit(req, 'SEARCH_REPORTS', qtext, { count: rows.length });
  res.json({ results: rows });
});

router.post('/reports', requirePerm('WRITE_REPORTS'), async (req, res) => {
  const { title, type, details, tags, officersinvolved, civsinvolved, gallery, jobtype } = req.body || {};
  if (!title || !details) return res.status(400).json({ error: 'missing_fields' });

  const time = `${Date.now()}`;
  await q(
    "INSERT INTO mdt_reports (author, title, type, details, tags, officersinvolved, civsinvolved, gallery, time, jobtype) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      req.user.discord_name || 'CAD',
      String(title),
      String(type || 'Report'),
      String(details),
      String(tags || ''),
      String(officersinvolved || ''),
      String(civsinvolved || ''),
      String(gallery || ''),
      time,
      String(jobtype || 'police'),
    ]
  );

  await audit(req, 'CREATE_REPORT', String(title).slice(0,64), {});
  res.json({ ok: true });
});

// BOLOs
router.get('/bolos', requirePerm('VIEW_REPORTS'), async (req, res) => {
  const qtext = (req.query.q || '').toString().trim();
  if (!qtext) return res.status(400).json({ error: 'missing_query' });

  const rows = await q(
    "SELECT id, author, title, plate, owner, individual, time, jobtype FROM mdt_bolos WHERE title LIKE ? OR plate LIKE ? OR owner LIKE ? OR individual LIKE ? ORDER BY id DESC LIMIT 50",
    [`%${qtext}%`, `%${qtext}%`, `%${qtext}%`, `%${qtext}%`]
  );

  await audit(req, 'SEARCH_BOLOS', qtext, { count: rows.length });
  res.json({ results: rows });
});

router.post('/bolos', requirePerm('WRITE_BOLOS'), async (req, res) => {
  const { title, plate, owner, individual, detail, tags, gallery, officersinvolved, jobtype } = req.body || {};
  if (!title) return res.status(400).json({ error: 'missing_fields' });

  const time = `${Date.now()}`;
  await q(
    "INSERT INTO mdt_bolos (author, title, plate, owner, individual, detail, tags, gallery, officersinvolved, time, jobtype) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      req.user.discord_name || 'CAD',
      String(title),
      String(plate || ''),
      String(owner || ''),
      String(individual || ''),
      String(detail || ''),
      String(tags || ''),
      String(gallery || ''),
      String(officersinvolved || ''),
      time,
      String(jobtype || 'police'),
    ]
  );

  await audit(req, 'CREATE_BOLO', String(title).slice(0,64), {});
  res.json({ ok: true });
});

function normalizeCitizen(row) {
  let charinfo = {};
  let metadata = {};
  let job = row.job;
  let gang = row.gang;

  try { charinfo = JSON.parse(row.charinfo || '{}'); } catch {}
  try { metadata = JSON.parse(row.metadata || '{}'); } catch {}
  try { job = typeof row.job === 'string' ? JSON.parse(row.job) : row.job; } catch {}
  try { gang = typeof row.gang === 'string' ? JSON.parse(row.gang) : row.gang; } catch {}

  return {
    citizenid: row.citizenid,
    charinfo,
    job,
    gang,
    metadata,
  };
}

export default router;
