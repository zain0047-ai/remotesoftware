/**
 * Cross-company isolation smoke tests (API-level).
 * Run: node scripts/test-tenant-isolation.mjs
 * Requires server on PORT (default 43123) with SETUP_SECRET from env/.env
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const BASE = process.env.TEST_BASE || "http://127.0.0.1:43123";

function loadEnv() {
  const p = join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

function jar() {
  return { cookie: "" };
}

async function req(path, { method = "GET", body, jar: j, headers = {} } = {}) {
  const h = { ...headers };
  if (body) h["Content-Type"] = "application/json";
  if (j?.cookie) h.Cookie = j.cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() || [];
  if (j && set.length) {
    j.cookie = set.map((c) => c.split(";")[0]).join("; ");
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }
  return { status: res.status, json, text };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const setupSecret = process.env.SETUP_SECRET || "local-dev-only";
  const results = [];

  // Bootstrap super admin (ok if already exists)
  const boot = await req("/api/auth/bootstrap", {
    method: "POST",
    body: {
      name: "Platform Owner",
      email: `super_${Date.now()}@example.com`,
      password: "SuperSecret1",
      setupSecret,
    },
  });
  if (boot.status === 403 && /already complete/i.test(boot.json?.error || "")) {
    results.push("bootstrap: already complete (ok)");
  } else if (boot.status === 200 && boot.json?.ok) {
    results.push("bootstrap: created super admin");
  } else {
    // try login existing via known - skip if can't bootstrap
    results.push(`bootstrap: ${boot.status} ${boot.json?.error || "skipped"}`);
  }

  const superJar = jar();
  const superLogin = await req("/api/auth/login", {
    method: "POST",
    jar: superJar,
    body: {
      email: boot.json?.user?.email || process.env.SUPER_EMAIL || "owner@example.com",
      password: process.env.SUPER_PASSWORD || "SuperSecret1",
      portal: "super",
    },
  });

  // If bootstrap succeeded use that cookie from set-cookie on boot
  let adminCookieJar = superJar;
  if (boot.status === 200 && boot.json?.ok) {
    adminCookieJar = jar();
    // re-login with created email
    const relog = await req("/api/auth/login", {
      method: "POST",
      jar: adminCookieJar,
      body: {
        email: boot.json.user.email,
        password: "SuperSecret1",
        portal: "super",
      },
    });
    assert(relog.status === 200 && relog.json?.ok, "super login after bootstrap");
    results.push("super login: ok");
  } else if (superLogin.status === 200 && superLogin.json?.ok) {
    results.push("super login: ok (existing)");
  } else {
    console.log("WARN: could not login super admin; creating companies may fail");
  }

  const stamp = Date.now().toString(36);
  const coA = await req("/api/platform/companies", {
    method: "POST",
    jar: adminCookieJar,
    body: {
      name: `Alpha ${stamp}`,
      slug: `alpha-${stamp}`,
      planCode: "trial",
      adminName: "Alpha Admin",
      adminEmail: `alpha.admin.${stamp}@example.com`,
      adminPassword: "AlphaAdmin1",
    },
  });
  const coB = await req("/api/platform/companies", {
    method: "POST",
    jar: adminCookieJar,
    body: {
      name: `Beta ${stamp}`,
      slug: `beta-${stamp}`,
      planCode: "trial",
      adminName: "Beta Admin",
      adminEmail: `beta.admin.${stamp}@example.com`,
      adminPassword: "BetaAdmin1",
    },
  });
  assert(coA.status === 200 && coA.json?.ok, `create A: ${coA.text}`);
  assert(coB.status === 200 && coB.json?.ok, `create B: ${coB.text}`);
  results.push("create companies A/B: ok");

  const jarA = jar();
  const jarB = jar();
  const loginA = await req("/api/auth/login", {
    method: "POST",
    jar: jarA,
    body: {
      email: `alpha.admin.${stamp}@example.com`,
      password: "AlphaAdmin1",
      portal: "admin",
      companySlug: `alpha-${stamp}`,
    },
  });
  const loginB = await req("/api/auth/login", {
    method: "POST",
    jar: jarB,
    body: {
      email: `beta.admin.${stamp}@example.com`,
      password: "BetaAdmin1",
      portal: "admin",
      companySlug: `beta-${stamp}`,
    },
  });
  assert(loginA.status === 200 && loginA.json?.ok, "login A");
  assert(loginB.status === 200 && loginB.json?.ok, "login B");
  results.push("company admin logins: ok");

  // A must not see B employees
  const storeA = await req("/api/store", { jar: jarA });
  const storeB = await req("/api/store", { jar: jarB });
  const emailsA = (storeA.json?.state?.employees || []).map((e) => e.email);
  const emailsB = (storeB.json?.state?.employees || []).map((e) => e.email);
  assert(
    !emailsA.includes(`beta.admin.${stamp}@example.com`),
    "A must not see B admin email",
  );
  assert(
    !emailsB.includes(`alpha.admin.${stamp}@example.com`),
    "B must not see A admin email",
  );
  assert(storeA.json?.company?.id !== storeB.json?.company?.id, "tenant ids differ");
  results.push("GET store isolation: ok");

  // Cross-tenant upload download: create file in A, try with B cookie
  const form = new FormData();
  form.append(
    "file",
    new Blob(["secret-a"], { type: "text/plain" }),
    "secret-a.txt",
  );
  const up = await fetch(`${BASE}/api/uploads`, {
    method: "POST",
    headers: { Cookie: jarA.cookie },
    body: form,
  });
  const upJson = await up.json();
  assert(up.ok && upJson.url, "upload A");
  const name = upJson.url.split("/").pop();
  const cross = await req(`/api/uploads/${name}`, { jar: jarB });
  assert(cross.status === 404 || cross.status === 403, "B cannot download A's file");
  results.push("upload cross-tenant blocked: ok");

  // Wrong company slug login
  const wrong = await req("/api/auth/login", {
    method: "POST",
    body: {
      email: `alpha.admin.${stamp}@example.com`,
      password: "AlphaAdmin1",
      portal: "admin",
      companySlug: `beta-${stamp}`,
    },
  });
  assert(wrong.status === 401, "credentials do not cross companies");
  results.push("cross-company credential reuse blocked: ok");

  // Unauthenticated bootstrap without secret
  const openBoot = await req("/api/auth/bootstrap", {
    method: "POST",
    body: {
      name: "Hacker",
      email: "hacker@example.com",
      password: "HackerPass1",
      setupSecret: "wrong",
    },
  });
  assert(openBoot.status === 403, "bootstrap requires setup secret");
  results.push("bootstrap locked: ok");

  // Role-scoped reads: register employee under A, approve via admin store write,
  // then employee GET must not include peer emails / other sessions.
  const empEmail = `emp.${stamp}@example.com`;
  const reg = await req("/api/auth/register", {
    method: "POST",
    body: {
      name: "Emp One",
      email: empEmail,
      password: "EmpPass12",
      companySlug: `alpha-${stamp}`,
      role: "employee",
    },
  });
  assert(reg.status === 200 && reg.json?.ok, "register employee");

  const before = await req("/api/store", { jar: jarA });
  const pending = (before.json?.state?.employees || []).find(
    (e) => e.email === empEmail,
  );
  assert(pending, "pending employee visible to admin");
  const approvedEmployees = (before.json.state.employees || []).map((e) =>
    e.id === pending.id
      ? { ...e, status: "active", reviewedAt: new Date().toISOString() }
      : e,
  );
  const put = await req("/api/store", {
    method: "PUT",
    jar: jarA,
    body: {
      version: before.json.version,
      state: { ...before.json.state, employees: approvedEmployees },
    },
  });
  assert(put.status === 200, "admin approve employee via store");

  const jarE = jar();
  const loginE = await req("/api/auth/login", {
    method: "POST",
    jar: jarE,
    body: {
      email: empEmail,
      password: "EmpPass12",
      portal: "employee",
      companySlug: `alpha-${stamp}`,
    },
  });
  assert(loginE.status === 200 && loginE.json?.ok, "employee login");
  const empState = loginE.json.state;
  const empEmails = (empState.employees || [])
    .map((e) => e.email)
    .filter(Boolean);
  assert(
    empEmails.every((em) => em === empEmail),
    "employee must not receive peer emails",
  );
  assert(
    (empState.backups || []).length === 0,
    "employee must not receive backups",
  );
  assert(
    !(empState.employees || []).some(
      (e) => e.email === `alpha.admin.${stamp}@example.com`,
    ),
    "employee must not see admin email",
  );
  results.push("employee role-scoped store read: ok");

  console.log("PASS");
  for (const r of results) console.log(" -", r);
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
