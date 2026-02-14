/**
 * IRP Status + Applications Worker
 *
 * Routes:
 *   GET  /status  -> FiveM status (via official listing API) + Discord member/online counts
 *   POST /apply   -> Post application embed to a Discord channel
 *
 * Required Worker settings:
 *   - Secret:  DISCORD_BOT_TOKEN
 *   - Var:     DISCORD_GUILD_ID     (1462098962692706472)
 *   - Var:     DISCORD_CHANNEL_ID   (1472095552652181516)
 *   - Var:     FIVEM_JOIN_CODE      (z5bz49)
 *
 * CORS locked to:
 *   https://illicitrp.com
 *   https://www.illicitrp.com
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const allowedOrigins = new Set([
      "https://illicitrp.com",
      "https://www.illicitrp.com",
    ]);

    const origin = request.headers.get("Origin") || "";
    const allowOrigin = allowedOrigins.has(origin) ? origin : "https://illicitrp.com";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(allowOrigin) });
    }

    if (url.pathname === "/status" && request.method === "GET") {
      return handleStatus(env, allowOrigin);
    }

    if (url.pathname === "/apply" && request.method === "POST") {
      // Only accept browser posts from your site
      if (!allowedOrigins.has(origin)) {
        return json({ ok: false, error: "Forbidden" }, 403, allowOrigin, 0);
      }
      return handleApply(request, env, allowOrigin);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleStatus(env, allowOrigin) {
  const join = env.FIVEM_JOIN_CODE || env.FIVEM_JOIN || "z5bz49";

  const [fivem, discord] = await Promise.all([
    fetchFiveM(join).catch((e) => ({ online: false, error: String(e?.message || e) })),
    fetchDiscordCounts(env).catch(() => null),
  ]);

  return json(
    {
      online: !!(fivem && fivem.online),
      fivem,
      discord: discord || null,
      updatedAt: new Date().toISOString(),
    },
    200,
    allowOrigin,
    15
  );
}

async function fetchFiveM(joinCode) {
  const api = `https://servers-frontend.fivem.net/api/servers/single/${encodeURIComponent(joinCode)}`;

  const res = await fetch(api, { headers: { "User-Agent": "IRP-Status-Worker" } });
  if (!res.ok) throw new Error(`FiveM listing failed (${res.status})`);

  const data = await res.json();
  const server = data?.Data;

  const hostnameRaw = server?.hostname || "Illicit Roleplay (IRP)";
  const hostname = stripFiveMCodes(hostnameRaw);

  const clients = Number(server?.clients ?? 0);
  const svMax = Number(server?.sv_maxclients ?? server?.vars?.sv_maxClients ?? 128);

  const vars = server?.vars || {};
  const detailParts = [];
  if (vars?.tags) detailParts.push(stripFiveMCodes(String(vars.tags)));
  if (vars?.locale) detailParts.push(String(vars.locale));

  return {
    online: true,
    joinCode,
    name: hostname,
    players: clients,
    maxPlayers: svMax,
    details: detailParts.length ? detailParts.join(" • ") : "",
  };
}

async function fetchDiscordCounts(env) {
  const token = env.DISCORD_BOT_TOKEN;
  const guildId = env.DISCORD_GUILD_ID;

  if (!token || !guildId) return null;

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
    headers: { Authorization: `Bot ${token}` },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    members: data?.approximate_member_count ?? null,
    online: data?.approximate_presence_count ?? null,
  };
}

async function handleApply(request, env, allowOrigin) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400, allowOrigin, 0);
  }

  const type = safeStr(body?.type, 48) || "Application";
  const name = safeStr(body?.name, 128);
  const discordTag = safeStr(body?.discord, 128);

  if (!name || name.length < 2) return json({ ok: false, error: "Name is required" }, 400, allowOrigin, 0);
  if (!discordTag || discordTag.length < 2) return json({ ok: false, error: "Discord is required" }, 400, allowOrigin, 0);

  const fields = [];
  for (const [k, v] of Object.entries(body || {})) {
    if (v === null || v === undefined) continue;
    if (["turnstileToken", "captcha", "csrf"].includes(k)) continue;

    const key = safeStr(k, 80);
    const val = safeStr(typeof v === "string" ? v : JSON.stringify(v), 1000);

    if (key.toLowerCase() === "type") continue;
    if (key.toLowerCase() === "name") continue;
    if (key.toLowerCase() === "discord") continue;

    fields.push({ name: key, value: val || "-", inline: false });
    if (fields.length >= 18) break;
  }

  const embed = {
    title: `New ${type}`,
    description: "Application submitted via illicitrp.com",
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
  const token = env.DISCORD_BOT_TOKEN;
  const channelId = env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) return false;

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify({ embeds: [embed] }),
  });

  return res.ok;
}

function stripFiveMCodes(str) {
  return String(str || "")
    .replace(/\^\d/g, "")
    .replace(/\s+\|\s+/g, " • ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeStr(v, max) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "false",
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
