# Deploy ClarityTrack

This app needs **persistent disk** for `data/store.json` (users, approvals, sessions).  
Do **not** use plain Vercel serverless without a database — the file store would reset on every deploy.

## Option A — Docker (VPS / local / any host)

```bash
docker compose up -d --build
```

App: `http://YOUR_SERVER_IP:43123`  
Data volume: `claritytrack-data`

## Option B — Railway

1. Push this repo to GitHub (or connect Origin remote if supported)
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a **Volume** mounted at `/app/data`
4. Set env:
   - `DATA_DIR=/app/data`
   - `PORT=43123`
5. Generate a public domain in Railway settings

`railway.toml` + `Dockerfile` are already in the repo.

## Option C — Render

1. [dashboard.render.com](https://dashboard.render.com) → New → Blueprint
2. Select this repo (`render.yaml`)
3. Confirm the disk mount at `/app/data`
4. Deploy — Render gives you a `*.onrender.com` URL

## First login after deploy

1. Open the public URL
2. **Create admin account** (first user = admin)
3. Employees register → you approve them in Admin

## Temporary public URL (Cloudflare tunnel)

While the server runs locally/in this VM:

```bash
npm run build && npm run start
cloudflared tunnel --url http://127.0.0.1:43123
```
