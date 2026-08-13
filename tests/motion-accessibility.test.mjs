import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("motion foundation exposes canonical durations and easing curves", () => {
  const tokens = read("src/app/design-tokens-v2.css");

  for (const token of [
    "--ds-duration-fast",
    "--ds-duration-base",
    "--ds-duration-slow",
    "--ds-ease-standard",
    "--ds-ease-emphasized",
    "--ds-motion-fast",
    "--ds-motion-base",
    "--ds-motion-slow",
  ]) {
    assert.match(tokens, new RegExp(`${token}:`));
  }

  assert.match(tokens, /--transition-fast:\s*var\(--ds-motion-fast\)/);
  assert.match(tokens, /--transition-base:\s*var\(--ds-motion-base\)/);
});

test("application shell offers keyboard bypass and keyed route feedback", () => {
  const shell = read("src/components/application-shell.tsx");

  assert.match(shell, /href="#supreme-main-content"/);
  assert.match(shell, />\s*Pular para o conteúdo\s*</);
  assert.match(shell, /id="supreme-main-content"/);
  assert.match(shell, /tabIndex=\{-1\}/);
  assert.match(shell, /key=\{pathname\} className="app-route-transition"/);
});

test("route feedback uses compositor-friendly properties", () => {
  const globals = read("src/app/globals.css");
  const routeAnimation = globals.match(
    /@keyframes app-route-enter\s*\{[\s\S]*?\n\}/
  )?.[0];

  assert.ok(routeAnimation);
  assert.match(routeAnimation, /opacity:/);
  assert.match(routeAnimation, /transform:/);
  assert.doesNotMatch(routeAnimation, /(?:width|height|top|left|filter):/);
  assert.match(globals, /animation:\s*app-route-enter var\(--ds-motion-slow\) both/);
});

test("reduced motion removes route and control transforms", () => {
  const globals = read("src/app/globals.css");
  const shellStyles = read("src/components/application-shell-v3.module.css");

  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(globals, /\.app-route-transition\s*\{\s*animation:\s*none;/s);
  assert.match(globals, /\.ui-button:active:not\(:disabled\)/);
  assert.match(shellStyles, /\.navLink:active/);
  assert.match(
    shellStyles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.navLink:active[\s\S]*transform:\s*none/
  );
});

test("roadmap records the completed motion milestone", () => {
  const roadmap = read("docs/ROADMAP.md");

  assert.match(roadmap, /- \[x\] motion e microinterações;/);
  assert.match(roadmap, /- \[ \] revisão de acessibilidade e performance\./);
});
