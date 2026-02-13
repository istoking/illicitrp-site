import fetch from 'node-fetch';

const DISCORD_API = 'https://discord.com/api/v10';

export async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });

  const r = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Discord token exchange failed: ${r.status} ${t}`);
  }

  return r.json();
}

export async function getDiscordUser(accessToken) {
  const r = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Discord user fetch failed: ${r.status}`);
  return r.json();
}

export async function getMemberRoles(discordUserId) {
  // Requires bot token + guild id
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  const r = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Discord guild member fetch failed: ${r.status} ${t}`);
  }

  const member = await r.json();
  return member.roles || [];
}

export async function getGuildRoles() {
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  const r = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Discord guild roles fetch failed: ${r.status} ${t}`);
  }

  return r.json(); // array of roles
}
