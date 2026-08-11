import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const tokens = read("src/app/design-tokens-v2.css");
const layout = read("src/app/layout.tsx");
const globals = read("src/app/globals.css");

test("Design System v2 loads after the legacy global stylesheet", () => {
  const globalsImport = layout.indexOf('import "./globals.css"');
  const tokensImport = layout.indexOf('import "./design-tokens-v2.css"');

  assert.ok(globalsImport >= 0);
  assert.ok(tokensImport > globalsImport);
});

test("Design System v2 owns canonical visual values", () => {
  for (const token of [
    "--ds-bg-canvas",
    "--ds-surface",
    "--ds-surface-elevated",
    "--ds-border",
    "--ds-text-primary",
    "--ds-text-secondary",
    "--ds-brand-accent",
    "--ds-success",
    "--ds-warning",
    "--ds-danger",
    "--ds-radius-md",
    "--ds-shadow-card",
    "--ds-motion-fast",
  ]) {
    assert.match(tokens, new RegExp(`${token}:\\s*(?!var\\()[^;]+;`));
  }
});

test("foundation and legacy names are aliases instead of duplicate base values", () => {
  const aliases = [
    "--background",
    "--surface",
    "--surface-elevated",
    "--border",
    "--text-primary",
    "--text-secondary",
    "--accent",
    "--success",
    "--warning",
    "--danger",
    "--color-bg-app",
    "--color-bg-primary",
    "--color-bg-secondary",
    "--color-bg-tertiary",
    "--color-bg-input",
    "--color-border",
    "--color-border-strong",
    "--color-text-primary",
    "--color-text-secondary",
    "--color-text-muted",
    "--color-primary",
    "--color-primary-hover",
    "--color-accent",
    "--color-accent-hover",
    "--color-success",
    "--color-warning",
    "--color-danger",
    "--color-info",
    "--radius-sm",
    "--radius-md",
    "--radius-lg",
    "--radius-full",
    "--shadow-card",
    "--transition-fast",
    "--transition-base",
  ];

  for (const token of aliases) {
    assert.match(tokens, new RegExp(`${token}:\\s*var\\(--ds-[^)]+\\);`));
  }
});

test("focus visibility remains tied to the semantic accent", () => {
  assert.match(globals, /:focus-visible\s*\{/);
  assert.match(globals, /outline:\s*3px solid color-mix\(in srgb, var\(--accent\) 72%, white\)/);
});
