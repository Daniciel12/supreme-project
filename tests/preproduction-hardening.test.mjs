import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildSecurityHeaders } from "../next.config.ts";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("registration conflict is generic and password work precedes duplicate lookup", () => {
  const source = read("src/app/api/auth/register/route.ts");

  assert.doesNotMatch(source, /Já existe um usuário cadastrado/i);
  assert.match(source, /Não foi possível concluir o cadastro/);
  assert.match(source, /P2002/);

  const hashIndex = source.indexOf("bcrypt.hash");
  const lookupIndex = source.indexOf("prisma.user.findUnique");
  assert.ok(hashIndex >= 0, "registration must hash the submitted password");
  assert.ok(lookupIndex >= 0, "registration must check the unique email");
  assert.ok(
    hashIndex < lookupIndex,
    "password hashing must occur before duplicate-email lookup"
  );
});

test("Next.js config applies the security header baseline", () => {
  const source = read("next.config.ts");

  for (const contract of [
    /X-Content-Type-Options/,
    /nosniff/,
    /Referrer-Policy/,
    /strict-origin-when-cross-origin/,
    /Permissions-Policy/,
    /camera=\(\), microphone=\(\), geolocation=\(\)/,
    /browsing-topics=\(\)/,
    /X-Frame-Options/,
    /DENY/,
    /source: "\/:path\*"/,
  ]) {
    assert.match(source, contract);
  }
});

test("production headers enforce HSTS and a bounded CSP", () => {
  const headers = new Map(
    buildSecurityHeaders("production").map(({ key, value }) => [key, value])
  );
  const csp = headers.get("Content-Security-Policy") ?? "";

  assert.equal(headers.get("Strict-Transport-Security"), "max-age=31536000");
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(csp, /'unsafe-eval'/);
  assert.match(csp, /img-src[^;]+https:\/\/utfs\.io[^;]+https:\/\/\*\.ufs\.sh/);
  assert.match(csp, /connect-src[^;]+https:\/\/\*\.uploadthing\.com/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /upgrade-insecure-requests/);
});

test("development CSP permits tooling without persisting HSTS", () => {
  const headers = new Map(
    buildSecurityHeaders("development").map(({ key, value }) => [key, value])
  );
  const csp = headers.get("Content-Security-Policy") ?? "";

  assert.equal(headers.has("Strict-Transport-Security"), false);
  assert.match(csp, /'unsafe-eval'/);
  assert.match(csp, /connect-src[^;]+ws: wss:/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
});

test("CI blocks high-severity dependency findings", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /git push|contents: write|package-lock-only/);
});

test("Effect security override removes vulnerable UploadThing copies", () => {
  const manifest = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));

  assert.equal(manifest.overrides?.effect, "3.20.0");
  assert.equal(lock.packages?.["node_modules/effect"]?.version, "3.20.0");
  assert.equal(
    lock.packages?.["node_modules/@uploadthing/shared/node_modules/effect"],
    undefined
  );
  assert.equal(
    lock.packages?.["node_modules/uploadthing/node_modules/effect"],
    undefined
  );
});

test("environment template documents required keys without real secrets", () => {
  const environment = read(".env.example");
  const gitignore = read(".gitignore");

  for (const key of [
    "DATABASE_URL",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "UPLOADTHING_TOKEN",
  ]) {
    assert.match(environment, new RegExp(`^${key}=`, "m"));
  }

  assert.match(environment, /replace-with-a-long-random-secret/);
  assert.doesNotMatch(environment, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(environment, /sk_live|sk_test|-----BEGIN PRIVATE KEY-----/i);
  assert.match(gitignore, /\.env\*/);
  assert.match(gitignore, /!\.env\.example/);
});

test("README describes real setup and production readiness", () => {
  const readme = read("README.md");

  assert.doesNotMatch(readme, /bootstrapped with [`']create-next-app/i);
  for (const contract of [
    /Node\.js 22/,
    /PostgreSQL 16/,
    /NEXTAUTH_SECRET/,
    /UPLOADTHING_TOKEN/,
    /npm audit --audit-level=high/,
    /Checklist pré-produção/,
    /Rate limiting\/anti-abuse/,
    /Backups do PostgreSQL/,
    /Smoke test autenticado/,
  ]) {
    assert.match(readme, contract);
  }
});
