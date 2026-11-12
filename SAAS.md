# ClarityTrack Multi-Tenant SaaS

Upgrade of the existing single-org ClarityTrack app into a multi-company SaaS platform **without** replacing the JSON file store or rewriting the employee/admin portals from scratch.

## Existing architecture (foundation)

- **Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind, shadcn/ui
- **Persistence:** per-deployment JSON under `DATA_DIR` (default `./data`)
- **Auth:** scrypt password hashes + HMAC httpOnly session cookie
- **Client sync:** `StoreProvider` GET/PUT `/api/store` with role-aware server merge
- **Desktop:** Electron shell loads the same web URL (`desktop/`)

## What changed

### Tenant isolation

| Layer | Before | After |
|-------|--------|-------|
| Platform | n/a | `data/platform.json` (super admins, companies, plans, audits) |
| Company data | `data/store.json` | `data/tenants/{tenantId}/store.json` |
| Uploads | `data/uploads/` | `data/tenants/{tenantId}/uploads/` |
| Session | `userId` only | `{ kind, userId, tenantId, role }` signed claims |
| APIs | Global store | Tenant resolved **only** from cookie — never from client body |

Company A cannot read/write Company B’s store file, uploads, or APIs by changing IDs.

### Roles

1. **Super Admin** — `/super` portal; creates companies & plans  
2. **Company Admin** — existing `/admin/*` scoped to their tenant  
3. **Manager** — existing `/manager/*` within tenant  
4. **Employee** — existing `/app/*` + desktop client within tenant  

### Bootstrap security

`POST /api/auth/bootstrap` now creates the **first Super Admin only** and requires `SETUP_SECRET` (or `local-dev-only` in non-production). It no longer grants open first-visitor admin on a fresh company store.

### Subscriptions

Plans: Free Trial, Basic, Professional, Enterprise (configurable in Super Admin → Plans).

When expired/suspended:

- Employees/managers cannot log in  
- Company admins may still sign in to renew/view status  
- Data is **not** deleted  

## How Super Admin creates a company

1. Sign in with portal **Super Admin**  
2. Open `/super` → **New company**  
3. Enter company name, slug (Company ID), plan, and company admin credentials  
4. Platform creates `tenants/{id}/store.json` and an **active** company admin  

The company admin signs in with:

- Portal: **Company admin**  
- **Company ID** = slug  
- Their email/password  

## Migration of existing data

On first boot after upgrade, if legacy `data/store.json` exists and no companies are registered:

1. Create company **Default Company** with slug `default`  
2. Move `store.json` → `tenants/{id}/store.json`  
3. Move `uploads/` under that tenant  

Existing users sign in with **Company ID `default`**.

## Environment

```bash
cp .env.example .env
# set SESSION_SECRET, SETUP_SECRET
# optional: RESEND_API_KEY, EMAIL_FROM, DATA_DIR
```

## Isolation tests

With the server running:

```bash
npm run test:isolation
```

Checks: two companies cannot see each other’s employees, cannot reuse credentials across slugs, cannot download each other’s uploads, bootstrap without secret fails.

## New / modified modules (high level)

**New:** `src/lib/platform-*.ts`, `tenant-paths.ts`, `migrate-tenancy.ts`, `request-context.ts`, `src/app/api/platform/**`, `src/app/super/**`, `scripts/test-tenant-isolation.mjs`, `SAAS.md`

**Modified:** auth routes, `/api/store`, uploads, `server-db.ts`, `session.ts`, `store.tsx`, home login, `app-shell`, env examples

## Remaining / optional

- Payment gateway (intentionally not integrated)  
- Automatic invoice emails  
- Soft-deleted company hard purge job  
- Manager invite UI (role already supported in store)  
