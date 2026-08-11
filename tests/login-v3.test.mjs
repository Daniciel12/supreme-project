import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const page = read("src/app/login/page.tsx");
const styles = read("src/app/login/login-v3.module.css");

test("login v3 preserves authentication and registration contracts", () => {
  assert.match(page, /signIn\("credentials"/);
  assert.match(page, /fetch\("\/api\/auth\/register"/);
  assert.match(page, /signIn\("google", \{ callbackUrl: "\/" \}\)/);
  assert.match(page, /getProviders\(\)/);
  assert.match(page, /providers\?\.google/);
  assert.match(page, /window\.location\.replace\("\/"\)/);
});

test("login v3 keeps safe OAuth error handling", () => {
  assert.match(page, /OAuthAccountNotLinked/);
  assert.match(page, /AccessDenied/);
  assert.match(page, /Não foi possível concluir o acesso com Google/);
  assert.doesNotMatch(page, /client_secret|access_token|allowDangerousEmailAccountLinking/);
});

test("login v3 associates labels and exposes errors accessibly", () => {
  assert.match(page, /htmlFor="email"/);
  assert.match(page, /id="email"/);
  assert.match(page, /htmlFor="password"/);
  assert.match(page, /id="password"/);
  assert.match(page, /role="alert"/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /autoComplete=\{mode === "login" \? "current-password" : "new-password"\}/);
});

test("login v3 is isolated, responsive and consumes semantic design tokens", () => {
  assert.match(page, /login-v3\.module\.css/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /var\(--background\)/);
  assert.match(styles, /var\(--surface\)/);
  assert.match(styles, /var\(--accent\)/);
  assert.match(styles, /var\(--border\)/);
});

test("legacy auth classes remain present during the v3 migration", () => {
  for (const className of [
    "main-content",
    "auth-wrapper",
    "card",
    "auth-title",
    "form",
    "form-label",
    "input",
    "error-text",
    "btn btn-primary",
    "oauth-section",
    "auth-divider",
    "oauth-button",
    "auth-footer",
    "link-button",
  ]) {
    assert.ok(page.includes(className), `missing legacy class ${className}`);
  }
});
