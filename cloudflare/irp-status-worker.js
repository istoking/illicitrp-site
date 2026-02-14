/**
 * Cloudflare Worker: IRP Status JSON
 * Endpoint: /status
 *
 * This version uses the FiveM server listing API (HTTPS) based on your join code,
 * so it works even when :30120 endpoints are not reachable from Cloudflare.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/status") {
      return new Response("Not found", { status: 404 });
    }

    const ALLOWED_ORIGINS = new Set([
      "https://illicitrp.com",
      "https://www.illicitrp.com",
    ]);

    const origin = request.headers.get("Origin") || "";
    const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "";

    const headers = (maxAgeSeconds) => ({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAgeSeconds}`,
      ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, "Vary": "Origin" } : {}),
    });

    const JOIN_CODE = "z5bz49";
    const API_URL = `https://servers-frontend.fivem.net/api/servers/single/${encodeURIComponent(JOIN_CODE)}`;

    const stripFiveMCodes = (s) => (s ? String(s).replace(/\^\d/g, "").replace(/\s+/g, " ").trim() : "");

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(API_URL, {
        signal: controller.signal,
        headers: { "User-Agent": "IRP-Status-Worker" },
      }).finally(() => clearTimeout(t));

      if (!res.ok) throw new Error(`FiveM API HTTP ${res.status}`);

      const json = await res.json();
      const d = json && json.Data ? json.Data : null;

      const name = stripFiveMCodes(d?.hostname) || "Illicit Roleplay (IRP)";
      const players = typeof d?.clients === "number" ? d.clients : null;
      const maxPlayers = typeof d?.sv_maxclients === "number" ? d.sv_maxclients : null;

      return new Response(JSON.stringify({
        online: true,
        name,
        players,
        maxPlayers,
        connect: `https://cfx.re/join/${JOIN_CODE}`,
        updatedAt: new Date().toISOString(),
        source: "servers-frontend.fivem.net",
      }, null, 2), { status: 200, headers: headers(15) });
    } catch (e) {
      return new Response(JSON.stringify({
        online: false,
        name: "Illicit Roleplay (IRP)",
        connect: `https://cfx.re/join/${JOIN_CODE}`,
        error: String(e?.message || e),
        updatedAt: new Date().toISOString(),
      }, null, 2), { status: 200, headers: headers(5) });
    }
  },
};
