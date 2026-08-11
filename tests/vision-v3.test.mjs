import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("vision v3 preserves UploadThing and vision API contracts", () => {
  const page = read("src/app/visao/page.tsx");

  assert.match(page, /endpoint="visionImageUploader"/);
  assert.match(page, /serverData\?\.image/);
  assert.match(page, /fetch\("\/api\/vision"\)/);
  assert.match(page, /fetch\(`\/api\/vision\?id=\$\{image\.id\}`/);
  assert.match(page, /method: "DELETE"/);
  assert.doesNotMatch(page, /method:\s*"POST"[\s\S]*\/api\/vision/);
});

test("vision v3 keeps confirmation, errors and upload feedback", () => {
  const page = read("src/app/visao/page.tsx");

  assert.match(page, /window\.confirm\("Remover esta referência do quadro de visão\?"\)/);
  assert.match(page, /onClientUploadComplete/);
  assert.match(page, /onUploadError/);
  assert.match(page, /role="alert"/);
  assert.match(page, /<LoadingState/);
  assert.match(page, /<ErrorState/);
  assert.match(page, /<EmptyState/);
});

test("vision v3 consumes canonical Design System v2 tokens", () => {
  const css = read("src/app/visao/visao.module.css");

  for (const token of [
    "--ds-surface",
    "--ds-surface-elevated",
    "--ds-border",
    "--ds-text-secondary",
    "--ds-accent",
    "--ds-danger",
    "--ds-motion-fast",
    "--ds-shadow-card",
  ]) {
    assert.match(css, new RegExp(token));
  }
});

test("vision v3 remains responsive and respects reduced motion", () => {
  const css = read("src/app/visao/visao.module.css");

  assert.match(css, /@media \(max-width: 1040px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none/);
});

test("vision v3 preserves image accessibility and lazy loading", () => {
  const page = read("src/app/visao/page.tsx");

  assert.match(page, /alt="Referência do quadro de visão"/);
  assert.match(page, /loading="lazy"/);
  assert.match(page, /aria-label="Remover referência do quadro de visão"/);
  assert.match(page, /aria-labelledby="vision-gallery-title"/);
});
