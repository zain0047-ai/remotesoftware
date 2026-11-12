# ClarityTrack — Multi-Company WFH Tracker (SaaS)

Transparent work-from-home tracker for remote teams: sessions, tasks, approvals, and admin reporting.

**Multi-tenant SaaS:** each company has isolated data under its own `tenant_id`. See [SAAS.md](./SAAS.md) for architecture, Super Admin flow, migration, and isolation tests.

## Web vs desktop

- **Browser install (PWA):** company admins copy **`/install`** and send it to staff. Employees open the link in Chrome / Edge / Safari and install ClarityTrack like an app (home screen / desktop icon). No App Store required.
- **Admin portal:** web or installed PWA — Next.js
- **Optional Electron desktop:** `desktop/` still works against the same server for deeper idle hooks.

## What you get

- **Admin (web):** approvals, Trello-style **Work allocation** board, **Meetings** (single or group, paste link, notify members, group chat), backups (manual download), reports (1 day / 1 week / 1 month / 1 year / manual range)
- **Employee (desktop recommended):** self-register (pending until admin approves), session start/end, breaks, idle countdown, task submissions, meeting inbox + group chat
- **Manager:** review submissions, team time overview, weekly task assignment

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123) for **admin**.

### Employee desktop client

```bash
npm run desktop:install
# with server already running:
CLARITYTRACK_URL=http://127.0.0.1:43123 npm run desktop:employee
```

See [`desktop/README.md`](./desktop/README.md).

### First-time setup

1. Set `SESSION_SECRET` and `SETUP_SECRET` in `.env`
2. Open the app — **Create Super Admin** (enter the setup secret)
3. In **Super Admin** (`/super`), create a company + company admin
4. Company admin signs in with **Company ID** (slug) on the Company admin portal
5. Employees register with the same Company ID → company admin approves them

Migrated single-tenant installs use Company ID `default`. There are **no demo accounts**.

## Environment

Copy [`.env.example`](./.env.example) to `.env`:

```bash
cp .env.example .env
```

- `SESSION_SECRET` — required for signed httpOnly login cookies (long random string)
- `RESEND_API_KEY` / `EMAIL_FROM` — optional; needed only for forgot-password email

## Notes

- Shared app data is stored on the server in `data/store.json`. Passwords are **hashed** (scrypt) and never sent to the browser. Login uses an httpOnly session cookie; `/api/store` requires that cookie for reads/writes.
- **Forgot password** emails a temporary password only to the account inbox via Resend (`RESEND_API_KEY`, optional `EMAIL_FROM`). The password is never returned in the browser response; the account password changes only after the email sends successfully.
- Browser idle detection is **tab activity presence** only; it does not capture key contents or clipboard.
- Screenshot “evidence” in the MVP is **simulated**. Real OS capture needs a future desktop agent with explicit permissions and approved policy.

## Deploy (production)

See **[DEPLOY.md](./DEPLOY.md)** for Docker, Railway, and Render.

Quick Docker:

```bash
docker compose up -d --build
```

Temporary public tunnel (while this machine is running):

```bash
npm run build && npm run start
cloudflared tunnel --url http://127.0.0.1:43123
```

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, file-based shared store.
