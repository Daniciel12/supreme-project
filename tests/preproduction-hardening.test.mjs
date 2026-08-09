import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

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
    /X-Frame-Options/,
    /DENY/,
    /source: "\/:path\*"/,
  ]) {
    assert.match(source, contract);
  }
});

test("CI blocks high-severity dependency findings", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /npm audit --audit-level=high/);
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
