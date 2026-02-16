/**
 * IRP Status + Applications Worker
 *
 * Routes:
 *   GET  /status  -> FiveM status (via official listing API) + Discord member/online counts
 *   POST /apply   -> Post application embed to a Discord channel
 *
 * CORS locked to:
 *   https://illicitrp.com
 *   https://www.illicitrp.com
 */

const memoryRL = new Map(); // fallback rate limit store (per isolate)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- CORS / Origin controls ----
    const allowedOrigins = new Set([
      "https://illicitrp.com",
      "https://www.illicitrp.com",
    ]);
    const origin = request.headers.get("Origin") || "";
    const allowOrigin = allowedOrigins.has(origin)
      ? origin
      : (env.ALLOWED_ORIGIN || "https://illicitrp.com");

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(allowOrigin) });
    }

    // Quiet favicon noise
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // Routes
    if (url.pathname === "/status" && request.method === "GET") {
      return handleStatus(env, allowOrigin);
    }

    // NOTE: /apply is POST only
    if (url.pathname === "/apply" && request.method === "POST") {
      // Only accept browser posts from your site
      if (!allowedOrigins.has(origin)) {
        return json({ ok: false, error: "Forbidden" }, 403, allowOrigin, 0);
      }
      return handleApply(request, env, allowOrigin);
    }

    if (url.pathname === "/changelog" && request.method === "GET") {
      return handleChangelog(request, env, allowOrigin);
    }

    if (url.pathname === "/changelog/archive" && request.method === "GET") {
      return handleChangelogArchive(request, env, allowOrigin);
    }

    if (url.pathname === "/changelog/archive/index" && request.method === "GET") {
      return handleChangelogArchiveIndex(env, allowOrigin);
    }

    return new Response("Not found", { status: 404 });
  },
};

// -----------------------------
// /status: FiveM + Discord counts
// -----------------------------
async function handleStatus(env, allowOrigin) {
  const join = env.FIVEM_JOIN_CODE || "z5bz49";

  const [fivem, discord] = await Promise.all([
    fetchFiveM(env, join).catch((e) => ({
      online: false,
      joinCode: join,
      name: "Illicit Roleplay",
      players: null,
      maxPlayers: Number(env.FIVEM_MAX_PLAYERS || 128),
      error: String(e?.message || e),
    })),
    fetchDiscordCounts(env).catch(() => null),
  ]);

  return json(
    {
      ok: true,
      online: !!fivem?.online,
      fivem,
      discord: discord || null,
      updatedAt: new Date().toISOString(),
    },
    200,
    allowOrigin,
    15
  );
}

async function fetchFiveM(env, joinCode) {
  // Official HTTPS listing endpoint (avoids port 30120 issues)
  const api = `https://servers-frontend.fivem.net/api/servers/single/${encodeURIComponent(joinCode)}`;
  globalThis.CHANGELOG_TAGS_OVERRIDE = String(env.CHANGELOG_TAGS || "");

  const res = await fetch(api, { headers: { "User-Agent": "IRP-Edge" } });
  if (!res.ok) throw new Error(`FiveM listing failed (${res.status})`);

  const data = await res.json();
  const s = data?.Data;

  const hostnameRaw = s?.hostname || "Illicit Roleplay";
  const name = stripFiveMCodes(hostnameRaw);

  const players = Number(s?.clients ?? 0);

  // Force the display to your configured max if present (so it shows 128)
  const cfgMax = Number(env.FIVEM_MAX_PLAYERS ?? 0);
  const apiMax = Number(s?.sv_maxclients ?? 0);
  const maxPlayers = cfgMax > 0 ? cfgMax : (apiMax > 0 ? apiMax : 128);

  const details = stripFiveMCodes(hostnameRaw)
    .replace(/\s+\|\s+/g, " • ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    online: true,
    joinCode,
    name,
    players,
    maxPlayers,
    details,
    connect: `https://cfx.re/join/${joinCode}`,
  };
}

async function fetchDiscordCounts(env) {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_GUILD_ID) return null;

  globalThis.CHANGELOG_TAGS_OVERRIDE = String(env.CHANGELOG_TAGS || "");

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}?with_counts=true`,
    { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } }
  );

  if (!res.ok) return null;

  const data = await res.json();
  return {
    members: data?.approximate_member_count ?? null,
    online: data?.approximate_presence_count ?? null,
  };
}

// -----------------------------
// /apply: Post applications to Discord channel
// -----------------------------
async function handleApply(request, env, allowOrigin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400, allowOrigin, 0);
  }

  const type = safeStr(body?.type, 48) || "Application";
  const name = safeStr(body?.name, 128);
  const discordTag = safeStr(body?.discord, 128);
  const message = safeStr(body?.message || body?.notes || "", 1500);

  if (!name || name.length < 2) return json({ ok: false, error: "Name is required" }, 400, allowOrigin, 0);
  if (!discordTag || discordTag.length < 2) return json({ ok: false, error: "Discord is required" }, 400, allowOrigin, 0);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";

  // ---------- SERVER-SIDE RATE LIMIT (recommended) ----------
  // Default: 1 request / 60s per IP (configurable via env vars)
  const rlLimit = clampInt(env.RL_LIMIT, 1, 50, 1);
  const rlWindow = clampInt(env.RL_WINDOW_SECONDS, 10, 3600, 60);

  // Keyed by IP + type + discord to prevent spam but also prevent duplicates for same user/type
  const rlKey = `rl:${ip}:${type.toLowerCase()}:${discordTag.toLowerCase()}`;

  const allowed = await rateLimit(env, rlKey, rlLimit, rlWindow);
  if (!allowed.ok) {
    // Quietly block; return 429 so you can see it in logs if needed
    return json(
      { ok: false, error: "Rate limited", retryAfterSeconds: allowed.retryAfterSeconds },
      429,
      allowOrigin,
      0
    );
  }

  // ---------- IDEMPOTENCY (prevents duplicate posts for same content) ----------
  // If user hits Generate + Copy quickly, or spams click, this stops duplicate embeds.
  const idemWindow = clampInt(env.IDEMPOTENCY_SECONDS, 10, 3600, 180); // default 3 mins
  const signature = stableStringify({
    type,
    name,
    discord: discordTag,
    message,
    // include other fields too so exact duplicates are blocked
    rest: body,
  });
  const idemHash = await sha256Hex(signature);
  const idemKey = `idem:${type.toLowerCase()}:${discordTag.toLowerCase()}:${idemHash}`;

  const firstTime = await idempotencyCheck(env, idemKey, idemWindow);
  if (!firstTime) {
    // Treat as success to avoid user retries; but do NOT post again
    return json({ ok: true, deduped: true }, 200, allowOrigin, 0);
  }

  const fields = [];
  for (const [k, v] of Object.entries(body)) {
    if (v === null || v === undefined) continue;
    const key = safeStr(k, 80);
    if (["turnstileToken", "captcha", "csrf"].includes(key)) continue;
    if (["message", "notes"].includes(key.toLowerCase())) continue;

    const val = safeStr(typeof v === "string" ? v : JSON.stringify(v), 1000);
    fields.push({ name: key, value: val || "-", inline: false });
    if (fields.length >= 18) break;
  }

  const embed = {
    title: `New ${type}`,
    description: message ? message : "Application submitted via illicitrp.com",
    color: 0xdc2626,
    fields: [
      { name: "Name", value: name, inline: true },
      { name: "Discord", value: discordTag, inline: true },
      ...fields,
    ],
    footer: { text: `IP: ${ip} • UA: ${ua.slice(0, 60)}` },
    timestamp: new Date().toISOString(),
  };

  const ok = await postToDiscordChannel(env, embed);
  if (!ok) return json({ ok: false, error: "Failed to post to Discord" }, 502, allowOrigin, 0);

  return json({ ok: true }, 200, allowOrigin, 0);
}

async function postToDiscordChannel(env, embed) {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CHANNEL_ID) return false;

  globalThis.CHANGELOG_TAGS_OVERRIDE = String(env.CHANGELOG_TAGS || "");

  const res = await fetch(
    `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      },
      body: JSON.stringify({ embeds: [embed] }),
    }
  );

  return res.ok;
}

// -----------------------------
// /changelog: Read Discord channel -> JSON
// -----------------------------
async async function handleChangelog(request, env, allowOrigin) {
  const token = env.DISCORD_BOT_TOKEN;
  const channelId = env.DISCORD_CHANGELOG_CHANNEL_ID;

  if (!token) return json({ ok: false, error: "Missing DISCORD_BOT_TOKEN" }, 500, allowOrigin, 0);
  if (!channelId) return json({ ok: false, error: "Missing DISCORD_CHANGELOG_CHANNEL_ID" }, 500, allowOrigin, 0);

  const displayLimit = clampInt(env.CHANGELOG_LIMIT, 1, 50, 25);
  const fetchLimit = clampInt(env.CHANGELOG_FETCH_LIMIT, Math.min(displayLimit, 1), 100, 100);

  globalThis.CHANGELOG_TAGS_OVERRIDE = String(env.CHANGELOG_TAGS || "");

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=${fetchLimit}`,
    { headers: { Authorization: `Bot ${token}` } }
  );

  if (!res.ok) return json({ ok: false, error: `Discord fetch failed (${res.status})` }, 502, allowOrigin, 30);

  const messages = await res.json();

  const allEntries = messages
    .map((m) => parseChangelogMessage(m, env.TIMEZONE || "Pacific/Auckland", env.DISCORD_GUILD_ID, channelId))
    .filter(Boolean);

  const entries = allEntries.slice(0, displayLimit);
  const older = allEntries.slice(displayLimit);

  // --- Archive (KV-backed, optional) ---
  const kv = getChangelogKV(env);
  let archive = { enabled: false, recentlyArchived: [], index: [] };

  if (kv) {
    archive.enabled = true;

    const prevDisplayed = (await kvGetJSON(kv, "changelog:displayed", [])).slice(0, displayLimit);
    const currDisplayed = entries.map((e) => e.id);

    const movedIds = prevDisplayed.filter((id) => !currDisplayed.includes(id));
    const movedEntries = movedIds
      .map((id) => allEntries.find((e) => e.id === id))
      .filter(Boolean);

    // Persist anything older than the display limit, plus anything that just got pushed out.
    const toArchive = dedupeById([...older, ...movedEntries]);

    if (toArchive.length) {
      let index = await kvGetJSON(kv, "changelog:archive:index", {}); // { "YYYY-MM": count }
      const monthLimit = clampInt(env.CHANGELOG_ARCHIVE_MONTH_LIMIT, 50, 2000, 750);

      for (const entry of toArchive) {
        const ym = (entry.date || "").slice(0, 7) || "unknown";
        const key = `changelog:archive:${ym}`;
        const month = await kvGetJSON(kv, key, []);
        const next = upsertEntry(month, entry);

        // keep newest first + trim
        next.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        if (next.length > monthLimit) next.length = monthLimit;

        await kvPutJSON(kv, key, next);

        index[ym] = next.length;
      }

      await kvPutJSON(kv, "changelog:archive:index", index);

      archive.index = Object.keys(index)
        .filter((k) => /^\d{4}-\d{2}$/.test(k))
        .sort((a, b) => (a < b ? 1 : -1))
        .map((month) => ({ month, count: index[month] }));
    } else {
      const index = await kvGetJSON(kv, "changelog:archive:index", {});
      archive.index = Object.keys(index)
        .filter((k) => /^\d{4}-\d{2}$/.test(k))
        .sort((a, b) => (a < b ? 1 : -1))
        .map((month) => ({ month, count: index[month] }));
    }

    // Recently archived = the last 5 items that were pushed out of the display window.
    archive.recentlyArchived = movedEntries
      .slice()
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .slice(0, 5);

    await kvPutJSON(kv, "changelog:displayed", currDisplayed);
  }

  return json(
    { ok: true, source: "discord", count: entries.length, entries, archive, updatedAt: new Date().toISOString() },
    200,
    allowOrigin,
    30
  );
}

async function handleChangelogArchive(request, env, allowOrigin) {
  const kv = getChangelogKV(env);
  if (!kv) return json({ ok: false, error: "Archive is disabled (missing CHANGELOG_KV binding)" }, 501, allowOrigin, 60);

  const url = new URL(request.url);
  const month = (url.searchParams.get("month") || "").trim();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ ok: false, error: "Missing or invalid month. Use ?month=YYYY-MM" }, 400, allowOrigin, 60);
  }

  const key = `changelog:archive:${month}`;
  const entries = await kvGetJSON(kv, key, []);
  return json({ ok: true, month, count: entries.length, entries, updatedAt: new Date().toISOString() }, 200, allowOrigin, 60);
}

async function handleChangelogArchiveIndex(env, allowOrigin) {
  const kv = getChangelogKV(env);
  if (!kv) return json({ ok: false, error: "Archive is disabled (missing CHANGELOG_KV binding)" }, 501, allowOrigin, 60);

  const index = await kvGetJSON(kv, "changelog:archive:index", {});
  const months = Object.keys(index)
    .filter((k) => /^\d{4}-\d{2}$/.test(k))
    .sort((a, b) => (a < b ? 1 : -1))
    .map((month) => ({ month, count: index[month] }));

  return json({ ok: true, months, updatedAt: new Date().toISOString() }, 200, allowOrigin, 60);
}

function getChangelogKV(env) {
  // Prefer a dedicated binding, but allow re-using RL_KV if that's what you already created.
  const kv = env.CHANGELOG_KV || env.RL_KV;
  // basic duck-typing for Cloudflare KV binding
  if (kv && typeof kv.get === "function" && typeof kv.put === "function") return kv;
  return null;
}

async function kvGetJSON(kv, key, fallback) {
  try {
    const v = await kv.get(key, { type: "json" });
    return v ?? fallback;
  } catch (_) {
    return fallback;
  }
}

async function kvPutJSON(kv, key, value) {
  // Keep it simple; KV is best-effort here
  try { await kv.put(key, JSON.stringify(value)); } catch (_) {}
}

function dedupeById(arr) {
  const seen = new Set();
  const out = [];
  for (const e of arr) {
    if (!e || !e.id) continue;
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

function upsertEntry(list, entry) {
  const idx = list.findIndex((x) => x && x.id === entry.id);
  if (idx === -1) return [...list, entry];
  const next = list.slice();
  next[idx] = { ...next[idx], ...entry };
  return next;
}


function parseChangelogMessage(msg, tz, guildId, channelId) {
  const content = String(msg?.content || "").trim();
  if (!content) return null;

  const rawLines = content.split("\n");
  const lines = rawLines.map((l) => String(l || "").trim()).filter(Boolean);
  if (!lines.length) return null;

  // ---- Tags (multi-tag supported) ----
  const allowed = parseAllowedTags();
  let tags = [];

  // [core, security] Title...
  const bracket = lines[0].match(/^\[([^\]]+)\]\s*(.*)$/);
  let firstLine = lines[0];
  if (bracket) {
    const inside = bracket[1];
    tags = tags.concat(inside.split(/[,|]/g).map((t) => slugify(t)));
    firstLine = bracket[2] || "";
  }

  // #core #security ...
  const hashMatches = (lines[0].match(/#[a-z0-9_-]+/gi) || []).map((h) => slugify(h.replace(/^#/, "")));
  if (hashMatches.length) {
    tags = tags.concat(hashMatches);
    // remove hashtags from title line
    firstLine = firstLine.replace(/#[a-z0-9_-]+/gi, "").trim();
  }

  // Tags: core, security
  for (const l of lines.slice(0, 3)) {
    const m = stripMarkdown(l).match(/^tags?\s*:\s*(.+)$/i);
    if (m) {
      tags = tags.concat(String(m[1] || "").split(/[,|]/g).map((t) => slugify(t)));
      break;
    }
  }

  tags = tags.map((t) => slugify(t)).filter(Boolean);

  // filter to allowed tags if provided
  if (allowed.length) tags = tags.filter((t) => allowed.includes(t));

  tags = dedupeStrings(tags);
  if (!tags.length) tags = ["other"];

  const primary = tags[0];
  const type = toTitle(primary);

  // ---- Title ----
  let title = stripMarkdown(firstLine || lines[0]).replace(/^#+\s*/, "").trim();
  if (!title) {
    // fallback: first non-tags line
    for (const l of lines) {
      const clean = stripMarkdown(l).replace(/^tags?\s*:\s*.+$/i, "").trim();
      if (clean && !clean.startsWith("#") && !clean.startsWith("[")) { title = clean; break; }
    }
  }
  if (!title) return null;

  // ---- Date / Time ----
  const createdIso = msg?.timestamp || msg?.edited_timestamp || null;
  const createdAtMs = createdIso ? Date.parse(createdIso) : 0;

  const dt = createdAtMs ? new Date(createdAtMs) : new Date();
  const date = formatDate(dt, tz);
  const time = formatTime(dt, tz);

  // ---- Details ----
  const details = [];
  const notes = [];

  for (const l of lines.slice(1)) {
    const clean = stripMarkdown(l);
    if (!clean) continue;
    if (/^tags?\s*:\s*/i.test(clean)) continue;

    if (/^[-*•]\s+/.test(clean)) {
      details.push(clean.replace(/^[-*•]\s+/, "").trim());
    } else {
      notes.push(clean);
    }
  }

  const url = (guildId && channelId && msg?.id)
    ? `https://discord.com/channels/${guildId}/${channelId}/${msg.id}`
    : null;

  return {
    id: msg?.id || null,
    type,
    tags,
    title,
    date,
    time,
    details,
    notes: notes.length ? notes.join("\n") : "",
    createdAt: createdIso,
    createdAtMs,
    url,
  };
}

function parseAllowedTags() {
  // CHANGELOG_TAGS: "core,economy,security,crime,gameplay,jobs,police,ui,website,other"
  try {
    const raw = (globalThis?.CHANGELOG_TAGS_OVERRIDE || "").trim();
    if (raw) return raw.split(",").map((s) => slugify(s)).filter(Boolean);
  } catch (_) {}

  return [];
}

function dedupeStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const s of arr) {
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function toTitle(slug) {
  return String(slug || "")
    .split(/[-_ ]+/g)
    .map((w) => w ? (w[0].toUpperCase() + w.slice(1)) : "")
    .join(" ")
    .trim() || "Other";
}

function formatDate(d, tz) {
  try {
    return new Intl.DateTimeFormat("en-NZ", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .format(d)
      .split("/")
      .reverse()
      .join("-");
  } catch (_) {
    return new Date(d).toISOString().slice(0, 10);
  }
}

function formatTime(d, tz) {
  try {
    return new Intl.DateTimeFormat("en-NZ", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  } catch (_) {
    const iso = new Date(d).toISOString();
    return iso.slice(11, 16);
  }
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}


// -----------------------------
// Rate limiting + Idempotency helpers
// -----------------------------
async function rateLimit(env, key, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);

  // Preferred: KV-backed limiter (works across all isolates)
  if (env.RL_KV) {
    const raw = await env.RL_KV.get(key);
    let state = raw ? safeJsonParse(raw) : null;
    if (!state || typeof state !== "object") state = { count: 0, reset: now + windowSeconds };

    if (state.reset <= now) {
      state = { count: 0, reset: now + windowSeconds };
    }

    state.count += 1;

    // Keep key alive slightly longer than window
    await env.RL_KV.put(key, JSON.stringify(state), { expirationTtl: windowSeconds + 10 });

    if (state.count > limit) {
      return { ok: false, retryAfterSeconds: Math.max(1, state.reset - now) };
    }
    return { ok: true, retryAfterSeconds: 0 };
  }

  // Fallback: in-memory limiter (best-effort)
  const v = memoryRL.get(key);
  if (!v || v.reset <= now) {
    memoryRL.set(key, { count: 1, reset: now + windowSeconds });
    cleanupMemoryRL(now);
    return { ok: true, retryAfterSeconds: 0 };
  }
  v.count += 1;
  if (v.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, v.reset - now) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

async function idempotencyCheck(env, key, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);

  if (env.RL_KV) {
    const existing = await env.RL_KV.get(key);
    if (existing) return false;
    await env.RL_KV.put(key, "1", { expirationTtl: windowSeconds + 10 });
    return true;
  }

  // In-memory fallback
  const v = memoryRL.get(key);
  if (v && v.reset > now) return false;
  memoryRL.set(key, { count: 1, reset: now + windowSeconds });
  cleanupMemoryRL(now);
  return true;
}

function cleanupMemoryRL(now) {
  // Lightweight cleanup to keep Map from growing forever
  if (memoryRL.size < 500) return;
  for (const [k, v] of memoryRL.entries()) {
    if (!v || v.reset <= now) memoryRL.delete(k);
  }
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function stableStringify(obj) {
  // Ensures stable ordering for hashing/deduping
  return JSON.stringify(sortKeysDeep(obj));
}

function sortKeysDeep(x) {
  if (Array.isArray(x)) return x.map(sortKeysDeep);
  if (x && typeof x === "object") {
    const out = {};
    for (const k of Object.keys(x).sort()) out[k] = sortKeysDeep(x[k]);
    return out;
  }
  return x;
}

async function sha256Hex(input) {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// -----------------------------
// Helpers
// -----------------------------
function stripFiveMCodes(str) {
  return String(str || "").replace(/\^\d/g, "").trim();
}

function stripMarkdown(s) {
  return String(s || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function safeStr(v, max) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(obj, status, origin, cacheSeconds = 15) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}
