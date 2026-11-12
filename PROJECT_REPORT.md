# ClarityTrack — Project Status Report

**Generated:** 5 Nov 2026, 6:40 PM (Asia/Karachi)  
**Product:** ClarityTrack — WFH Employee Tracker  
**Branch:** `main`  
**Source prompt:** WFH Employee Tracker R&D Prompt & Workflow PDF  

---

## Executive summary

ClarityTrack is a privacy-first remote-work MVP. The company admin creates the first account, employees self-register and wait for approval, then use work sessions, tasks, and reports. Idle detection is treated as a **signal**, not punishment. Screenshots in the web MVP are **simulated**. Shared data lives in a server JSON store so every device sees the same users and approvals.

**Status:** MVP usable · Shared store live · Permanent hosting configs ready · Permanent public domain still pending your Railway/Render (or similar) account.

---

## Key metrics

| Metric | Value |
|--------|------:|
| App routes | 13 |
| Roles | 3 (employee, manager, admin) |
| Trello export cards | 30 across 9 lists |
| R&D deliverables on `/rnd` | 20 |
| Approx. `src` lines | ~6,900 |
| Feature commits (after init) | 12 |

---

## What was built

### Auth & accounts
- First-admin bootstrap (no demo users)
- Employee self-registration → **pending** until admin approves
- Login blocked until approved / rejected messaging
- **Account** status (Approved/Pending/…) separate from **Signed in** (Online/Offline)

### Employee workspace (`/app`)
- Session start/end, monitoring notice + acknowledge
- Break, low-input, idle warning (signal only), dispute
- Tasks + daily submissions
- Reports + CSV export
- Transparency page (what is tracked, simulated evidence)

### Manager (`/manager`)
- Submission review (approve / revision / reject + feedback)
- Team time overview
- Weekly task assignment

### Admin (`/admin`)
- Pending registration queue
- Users & roles with Account + Signed in columns
- Monitoring policy
- Backup jobs + restore test plan
- Audit log

### R&D pack (`/rnd`)
- Full 20-deliverable documentation
- Mermaid workflow diagrams
- Competitive research matrix
- Trello board export: JSON / CSV / Markdown + import guide (`public/exports/`)

### Data & deploy
- Shared store: `data/store.json` via `/api/store` (GET/PUT/DELETE)
- Session id kept in browser `sessionStorage` (not shared across users)
- Production: `Dockerfile`, `docker-compose.yml`, `render.yaml`, `railway.toml`, `DEPLOY.md`
- Temporary public access via Cloudflare quick tunnel (expires when VM/tunnel stops)

---

## Routes

| Path | Audience | Purpose |
|------|----------|---------|
| `/` | Public | Admin setup / sign-in / employee register |
| `/app` | Employee | Work session |
| `/app/tasks` | Employee | Tasks + submissions |
| `/app/reports` | Employee | Reports + CSV |
| `/app/transparency` | Employee | Tracking transparency |
| `/manager` | Manager | Review queue |
| `/manager/team` | Manager | Team time |
| `/manager/tasks` | Manager | Assign tasks |
| `/admin` | Admin | Approvals, users, audit |
| `/admin/policy` | Admin | Monitoring policy |
| `/admin/backups` | Admin | Backups |
| `/rnd` | Anyone | R&D documentation |
| `/api/store` | Server | Shared state API |

---

## Architecture

| Layer | Decision |
|-------|----------|
| UI | Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui |
| State | Client React store synced to server JSON file |
| Auth | Email/password in store; roles; approval gate |
| Privacy | Transparent notice; no covert capture; idle ≠ productivity |
| Deploy | Standalone Docker image + volume for `/app/data` |

---

## Build timeline (Asia/Karachi)

| When | Milestone |
|------|-----------|
| 27 Oct 2026, 8:20 PM | Project initialized |
| 27 Oct 2026, 8:30 PM | MVP + R&D pack shipped |
| 27 Oct 2026, 8:38 PM | Trello board export |
| 27 Oct 2026, 8:58 PM | Employee self-registration |
| 27 Oct 2026, 9:01 PM | Admin approval before login |
| 27 Oct 2026, 9:09 PM | Nav stacking bug fixed |
| 27 Oct 2026, 9:13 PM | Shared server store + public tunnel |
| 27 Oct 2026, 9:22 PM | Demo accounts removed; admin bootstrap |
| 27 Oct 2026, 9:34 PM | Online/Offline presence tracking |
| 29 Oct 2026, 7:38 PM | Docker / Railway / Render deploy configs |

---

## How to use (current)

1. Open the running app (local `http://127.0.0.1:43123` or a fresh Cloudflare tunnel).
2. **Create admin account** (first user).
3. Employees use **Create account** → you **Approve** under Admin.
4. Approved employees sign in and use Work session / Tasks / Reports.

---

## Not built yet (Phase 2)

- Real OS screenshots / desktop agent (with explicit permissions)
- Production database (Postgres) instead of JSON file
- SSO / SCIM
- Email report delivery with retries
- Permanent public domain on your hosting account
- Covert monitoring — **out of scope / disallowed**

---

## Recommended next step

Push the repo to GitHub → deploy on **Railway** or **Render** with a disk volume at `/app/data` → use the permanent URL and create your admin account there.

See `DEPLOY.md` for step-by-step instructions.
