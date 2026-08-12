import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("mobile content keeps shared actions at a comfortable touch size", () => {
  const globals = read("src/app/globals.css");

  assert.match(
    globals,
    /@media \(max-width: 800px\)[\s\S]*\.ui-button,[\s\S]*\.ui-button--sm,[\s\S]*\.ut-dropzone-dark > \*\[data-ut-element="button"\][\s\S]*min-height:\s*44px/
  );
});

test("mobile forms and finance header actions use the available width", () => {
  const globals = read("src/app/globals.css");
  const finances = read("src/app/financas/finances.module.css");

  assert.match(
    globals,
    /@media \(max-width: 800px\)[\s\S]*\.form > \.ui-button,[\s\S]*\.form > \.btn\s*\{[^}]*width:\s*100%/s
  );
  assert.match(
    finances,
    /@media \(max-width: 760px\)[\s\S]*\.headerActions\s*\{[^}]*width:\s*100%[^}]*\}[\s\S]*\.headerActions :global\(\.ui-button\)\s*\{[^}]*width:\s*100%/s
  );
  assert.doesNotMatch(finances, /flex:\s*1 0 100%/);
});

test("roadmap records the completed mobile-first milestone", () => {
  const roadmap = read("docs/ROADMAP.md");

  assert.match(roadmap, /- \[x\] experiência mobile-first;/);
});
