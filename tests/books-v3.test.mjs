import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("books v3 preserves books API contracts", () => {
  const page = read("src/app/livros/page.tsx");

  assert.match(page, /fetch\("\/api\/books"\)/);
  assert.match(page, /fetch\("\/api\/books", \{/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /fetch\(`\/api\/books\/\$\{book\.id\}`, \{/);
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /method: "DELETE"/);
});

test("books v3 preserves progress and summary calculations", () => {
  const page = read("src/app/livros/page.tsx");

  assert.match(page, /Math\.min\(100, Math\.round\(\(book\.readPages \/ book\.totalPages\) \* 100\)\)/);
  assert.match(page, /result\.completed \+ \(book\.totalPages > 0 && book\.readPages === book\.totalPages \? 1 : 0\)/);
  assert.match(page, /pagesRead: result\.pagesRead \+ book\.readPages/);
  assert.match(page, /totalPages: result\.totalPages \+ book\.totalPages/);
  assert.match(page, /readPages > book\.totalPages/);
});

test("books editorial refinement turns reading progress into a library map", () => {
  const page = read("src/app/livros/page.tsx");

  assert.match(page, /Biblioteca em ação/);
  assert.match(page, /const libraryUnavailable =/);
  assert.match(page, /const remainingPages = Math\.max/);
  assert.match(page, /const libraryProgress =/);
  assert.match(page, /const libraryNarrative =/);
  assert.match(page, /A próxima leitura ainda espera um título/);
  assert.match(page, /A estante já virou repertório/);
  assert.match(page, /A leitura já está em movimento/);
  assert.match(page, /Próximos capítulos/);
});

test("books exposes portfolio and per-book progress accessibly", () => {
  const page = read("src/app/livros/page.tsx");

  assert.match(page, /aria-labelledby="reading-map-title"/);
  assert.match(page, /aria-label="Progresso total da biblioteca"/);
  assert.match(
    page,
    /aria-valuenow=\{libraryUnavailable \? undefined : libraryProgress\}/
  );
  assert.match(page, /aria-label=\{`Progresso de \$\{book\.title\}`\}/);
  assert.match(page, /aria-valuenow=\{progress\}/);
});

test("books v3 keeps explicit confirmation before removal", () => {
  const page = read("src/app/livros/page.tsx");

  assert.match(page, /window\.confirm/);
  assert.match(page, /Remover “\$\{book\.title\}” da biblioteca\?/);
  assert.match(page, /setBooks\(\(previous\) => previous\.filter/);
});

test("books v3 consumes canonical Design System v2 tokens", () => {
  const css = read("src/app/livros/livros.module.css");

  for (const token of [
    "--ds-surface",
    "--ds-border",
    "--ds-text-primary",
    "--ds-text-secondary",
    "--ds-accent",
    "--ds-danger",
    "--ds-motion-fast",
    "--ds-shadow-card",
    "--ds-brand-gradient",
    "--ds-border-accent",
    "--ds-motion-base",
  ]) {
    assert.match(css, new RegExp(token));
  }
});

test("books v3 remains responsive and respects reduced motion", () => {
  const css = read("src/app/livros/livros.module.css");

  assert.match(css, /@media \(max-width: 1040px\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none/);
  assert.match(css, /transform: none/);
});

test("books v3 preserves loading, error and empty states", () => {
  const page = read("src/app/livros/page.tsx");

  assert.match(page, /<LoadingState/);
  assert.match(page, /<ErrorState/);
  assert.match(page, /<EmptyState/);
  assert.match(page, /role="alert"/);
});
