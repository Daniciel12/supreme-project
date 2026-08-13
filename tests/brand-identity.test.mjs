import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("brand identity documents the Momentum Noir direction and constraints", () => {
  const guide = read("docs/BRAND_IDENTITY.md");

  assert.match(guide, /Momentum Noir/);
  assert.match(guide, /Acessibilidade é parte da marca/);
  assert.match(guide, /não depender de hover para comunicar estado/);
  assert.match(guide, /design-tokens-v2\.css/);
});

test("canonical tokens expose the shared Supreme visual signature", () => {
  const tokens = read("src/app/design-tokens-v2.css");

  for (const token of [
    "--ds-brand-gradient",
    "--ds-canvas-gradient",
    "--ds-surface-gradient",
    "--ds-border-subtle",
    "--ds-border-accent",
    "--ds-shadow-brand",
  ]) {
    assert.match(tokens, new RegExp(`${token}:`));
  }
});

test("shared shell, cards and page headers consume the brand tokens", () => {
  const globals = read("src/app/globals.css");
  const shell = read("src/components/application-shell-v3.module.css");

  assert.match(globals, /\.ui-card\s*\{[^}]*var\(--ds-surface-gradient\)/s);
  assert.match(globals, /\.ui-button--primary\s*\{[^}]*var\(--ds-brand-gradient\)/s);
  assert.match(globals, /\.ui-page-header::before\s*\{[^}]*var\(--ds-brand-gradient\)/s);
  assert.match(shell, /background:\s*var\(--ds-canvas-gradient\)/);
  assert.match(shell, /\.navLinkActive \.navIcon/);
  assert.match(shell, /var\(--ds-shadow-brand\)/);
});

test("roadmap records the completed visual identity milestone", () => {
  const roadmap = read("docs/ROADMAP.md");

  assert.match(roadmap, /- \[x\] identidade visual definitiva;/);
  assert.match(roadmap, /- \[x\] direção visual e tokens de marca;/);
  assert.match(roadmap, /- \[x\] refinamento editorial de login, Dashboard e módulos;/);
  assert.match(roadmap, /- \[x\] Visão;/);
});
