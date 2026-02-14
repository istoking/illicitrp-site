Cloudflare Worker setup (IRP Status)

1) Cloudflare Dashboard -> Workers & Pages -> Create Worker -> "Start with Hello World".
2) Name it: irp-status (or keep your existing).
3) Paste the contents of: cloudflare/irp-status-worker.js
4) Save & Deploy.
5) Test:
   https://<your-worker>.workers.dev/status

This Worker uses the official FiveM listing API (HTTPS) with join code z5bz49.
