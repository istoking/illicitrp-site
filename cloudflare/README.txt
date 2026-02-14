Cloudflare Worker setup (IRP Status + Applications)

This site is hosted on GitHub Pages. Do NOT store Discord tokens or webhooks in the website code.
The Worker holds secrets and talks to Discord safely.

Routes
- GET  /status  -> FiveM status + Discord member/online counts
- POST /apply   -> Sends an application embed into your Discord channel

Setup
1) Cloudflare Dashboard -> Workers & Pages -> Create Worker -> "Start with Hello World".
2) Name it: irp-status (or keep your existing).
3) Paste the contents of: cloudflare/irp-status-worker.js
4) Save & Deploy.

Worker Variables / Secrets
- Secret: DISCORD_BOT_TOKEN
- Variable: DISCORD_GUILD_ID = 1462098962692706472
- Variable: DISCORD_CHANNEL_ID = 1472095552652181516
- Variable: FIVEM_JOIN_CODE = z5bz49

Test
- https://<your-worker>.workers.dev/status

Site integration
- status.json includes worker.base = https://irp-status.istok-cac.workers.dev
- The status page will use the Worker when available to show both FiveM + Discord stats.
- Applications pages can submit directly to staff via POST /apply.
