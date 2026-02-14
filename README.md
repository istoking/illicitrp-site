# IllicitRP Website

Public website for **Illicit Roleplay (IllicitRP / IRP)** — a FiveM roleplay community.

This repo contains the static site used for:
- Server status + quick actions
- Changelog browsing
- SOP / downloads / handbook pages (as published on the site)
- Applications (generates a formatted submission for Discord tickets + optional admin logging)

## Live Site
- Official: https://illicitrp.com

## Features
- **Responsive UI** (desktop + mobile)
- **Changelog** with category filtering
- **Global search** (Ctrl+K) across site content
- **Applications generator**
  - Creates a clean submission for users to paste into Discord support tickets
  - Optional admin logging via a Cloudflare Worker (server-side)

## Tech Stack
- Static HTML/CSS/JS
- Hosted on **GitHub Pages**
- Optional backend integration via **Cloudflare Worker** for:
  - status.json / server status
  - application logging to Discord
  - changelog fetching (if configured)

## Development
This is a static site. You can run it locally with any static server.

### Quick start
Option A (Python):
```bash
python -m http.server 8080
```

Option B (Node):
```bash
npx serve .
```

Then open:
- http://localhost:8080

## Configuration
Some features read config from `status.json` (for example, Worker base URL).

If you are forking this repo, update values in:
- `status.json` (Worker base, support links, etc.)
- Any site content in `/docs` or relevant pages

## Contributing
PRs are welcome. If you’re unsure about a change, open an issue first.

## Credits
IllicitRP branding and assets belong to Illicit Roleplay / IRP and are used here for the official website.

## License
This project is licensed under the **MIT License** (see `LICENSE`).

> **Branding note:** The MIT license applies to the code in this repository. IllicitRP names/logos/branding assets are not granted for reuse as trademarks.
