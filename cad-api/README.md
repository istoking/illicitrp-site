# IRP CAD API (ps-mdt continuity)

This API provides a secure CAD portal that reads/writes the same MariaDB tables your in-city ps-mdt uses,
plus a small set of IRP CAD add-on tables for user accounts, permissions, and audit logs.

## What you get
- Discord OAuth login
- Discord role → permission mapping (with optional per-user overrides)
- Admin endpoints to grant/revoke permissions
- Audit logging on sensitive actions
- Endpoints for citizens, vehicles, properties (qb-houses), warrants, reports, bolos

## Install (recommended: same VPS as your FiveM server)
1) Create DB user with least privilege:
   - SELECT on QBCore tables (players, player_vehicles), qb-houses tables (player_houses, houselocations),
     ps-mdt tables (mdt_* you need)
   - SELECT/INSERT/UPDATE on IRP CAD add-on tables (irp_cad_*)

2) Apply `../sql/irp_cad.sql` to your `irpdev` database.

3) Create a Discord Application:
   - OAuth2 redirect: `https://cad-api.illicitrp.com/auth/discord/callback`
   - Scopes: `identify`
   - Copy Client ID and Client Secret into `.env`

4) Create a Discord bot and add it to your guild:
   - Copy Bot Token into `.env`
   - Add to guild with permissions to read members (no admin required).
   - This API uses the bot token to fetch member roles for RBAC.

5) Configure role mapping:
   - Edit `src/config/roles.json`
   - Map your Discord role IDs (preferred) or names.

6) Run:
   - `npm install`
   - `cp .env.example .env` and fill values
   - `npm run start`

7) Put behind Nginx (TLS):
   - Proxy `https://cad-api.illicitrp.com` → `http://127.0.0.1:8787`

## CAD Web
Host the static portal from `../cad-web` under `/cad/` on your existing GitHub Pages site.
