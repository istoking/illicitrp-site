# Deploy IRP Website on GitHub Pages with GoDaddy (illicitrp.com)

Last updated: 13 February 2026

## 1) Create a GitHub repo
- Example name: `irp-site`
- Upload all files from this package to the repo root (so `index.html` is at repo root)

## 2) Enable GitHub Pages
Repo → Settings → Pages
- Source: Deploy from a branch
- Branch: main
- Folder: /(root)
Save.

## 3) Set custom domain in GitHub
Settings → Pages → Custom domain
- illicitrp.com
Save.
After DNS works, enable Enforce HTTPS.

## 4) GoDaddy DNS records
GoDaddy → Manage DNS → Records

### A records (root)
Add four A records:
- @ → 185.199.108.153
- @ → 185.199.109.153
- @ → 185.199.110.153
- @ → 185.199.111.153

Remove any existing @ A record that points elsewhere.

### CNAME (www)
- www → istoking.github.io

Turn off domain forwarding if enabled.

## 5) Update Discord link
Edit `index.html` and replace `YOUR_DISCORD_INVITE` with your Discord invite URL.
