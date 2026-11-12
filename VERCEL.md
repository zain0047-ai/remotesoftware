# ClarityTrack ko Vercel pe deploy karna (Neon Postgres)

Ye app ab **Postgres (Neon)** pe data store karti hai aur file uploads **Vercel Blob**
pe — is liye Vercel serverless pe bilkul theek chalti hai. (Pehle JSON file store tha
jo Vercel pe nahi chal sakta tha.)

Jo cheezein chahiye:
- GitHub account (code yahan push hoga)
- Vercel account
- Neon Postgres (Vercel ke andar se 1 click me ban jata hai)

---

## Step 1 — Code GitHub pe daalo

Agar repo abhi GitHub pe nahi hai:

```bash
git init
git add -A
git commit -m "ClarityTrack: Postgres + Vercel Blob storage"
git branch -M main
git remote add origin https://github.com/<aapka-username>/<repo-name>.git
git push -u origin main
```

---

## Step 2 — Vercel pe project import karo

1. https://vercel.com/new khola
2. apna GitHub repo **Import** karo
3. Framework apne aap **Next.js** detect hoga — settings chhedne ki zaroorat nahi
4. **Deploy abhi mat dabao** — pehle neeche wali cheezein set karo (ya pehli deploy
   fail/khaali ho to baad me env add karke redeploy kar dena)

---

## Step 3 — Neon database jodo

Vercel project ke andar:

1. **Storage** tab → **Create Database** → **Neon (Postgres)** chuno
2. project se **Connect** kar do
3. Isse `DATABASE_URL` (aur `POSTGRES_URL`) env var **apne aap** set ho jata hai

> Alag se table banane ki zaroorat nahi — app pehli baar chalne par `kv_store`
> table khud bana leti hai.

---

## Step 4 — File uploads ke liye Blob (optional but recommended)

1. wahi **Storage** tab → **Create** → **Blob**
2. project se connect karo → `BLOB_READ_WRITE_TOKEN` env var set ho jayega

Ye na karo to app chalegi, bas task me file attach karna band rahega.

---

## Step 5 — Secrets set karo

Vercel project → **Settings → Environment Variables** me ye 2 add karo (Production +
Preview dono pe):

| Name | Value |
|------|-------|
| `SESSION_SECRET` | koi lamba random string (16+ characters) |
| `SETUP_SECRET`   | koi lamba random string (8+ characters) — pehla Super Admin banane ke liye |

Random string banane ka aasan tareeka (terminal me):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Step 6 — Deploy / Redeploy

**Deployments** tab → latest deployment pe **Redeploy** (taaki saare naye env vars
apply ho jayein). Deploy complete hone par Vercel aapko ek URL dega, jaise
`https://claritytrack-xxxx.vercel.app`.

---

## Step 7 — Pehli baar login (platform setup)

1. apna Vercel URL kholo
2. **Create Super Admin** — yahan **SETUP_SECRET** wali value daalni hogi, aur apna
   naam / email / password
3. Super Admin portal (`/super`) me jao → **New company** banao (company name, slug =
   Company ID, plan, aur company admin ka email/password)
4. Company admin ab **Company admin** portal pe apni **Company ID (slug)** + email /
   password se login karega
5. Employees usi Company ID se register karenge → company admin unhe approve karega

Bas — live ho gaya. ✅

---

## Local pe test karna (optional)

`.env.example` ko `.env.local` me copy karo aur apni values bharo (Neon ka
`DATABASE_URL`, `SESSION_SECRET`, `SETUP_SECRET`). Phir:

```bash
npm install
npm run dev
```

http://127.0.0.1:43123 khol kar wahi bootstrap flow follow karo.

---

## Dhyaan dene layak

- **Data ab Postgres me hai** — har deploy par reset nahi hoga (ye pehle problem thi).
- **Uploads public Blob URL** pe hote hain: URL me random suffix hota hai (guess nahi
  ho sakta), par link jiske paas hai wo download kar sakta hai. MVP ke liye theek;
  aage chahiye to signed/private URLs add kiye ja sakte hain.
- **Docker/Railway/Render** configs repo me abhi bhi hain, lekin Vercel ke liye zaroori
  nahi.
