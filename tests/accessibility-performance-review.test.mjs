import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const routeMetadata = [
  ["login", "Entrar"],
  ["habitos", "Hábitos"],
  ["financas", "Finanças"],
  ["metas", "Metas"],
  ["livros", "Livros"],
  ["treinos", "Treinos"],
  ["visao", "Visão"],
  ["configuracoes", "Conta"],
];

test("every product route exposes a unique descriptive title", () => {
  const rootLayout = read("src/app/layout.tsx");

  assert.match(rootLayout, /default:\s*"Dashboard \| Supreme"/);
  assert.match(rootLayout, /template:\s*"%s \| Supreme"/);

  const titles = routeMetadata.map(([route, title]) => {
    const layout = read(`src/app/${route}/layout.tsx`);
    assert.match(layout, /export const metadata: Metadata/);
    assert.match(layout, new RegExp(`title:\\s*"${title}"`));
    assert.match(layout, /description:\s*"[^"\n]+"/);
    return title;
  });

  assert.equal(new Set(titles).size, titles.length);
});

test("vision images reserve space and defer offscreen work safely", () => {
  const page = read("src/app/visao/page.tsx");
  const styles = read("src/app/visao/visao.module.css");

  assert.match(page, /width=\{1200\}/);
  assert.match(page, /height=\{900\}/);
  assert.match(page, /loading="lazy"/);
  assert.match(page, /decoding="async"/);
  assert.match(styles, /\.visionImage\s*\{[^}]*aspect-ratio:\s*4 \/ 3/s);
});

test("review documentation records guarantees and the safe image boundary", () => {
  const guide = read("docs/ACCESSIBILITY_PERFORMANCE.md");

  assert.match(guide, /título único e descritivo/);
  assert.match(guide, /prefers-reduced-motion/);
  assert.match(guide, /inclusive SVG/);
  assert.match(guide, /migration\s+aditiva/);
  assert.match(guide, /smoke autenticado/);
});

test("roadmap records Frontend v3 as complete and the current lifecycle validation", () => {
  const roadmap = read("docs/ROADMAP.md");

  assert.match(roadmap, /## ✅ 9\. Frontend v3 — concluído/);
  assert.match(roadmap, /- \[x\] motion e microinterações;/);
  assert.match(roadmap, /- \[x\] revisão de acessibilidade e performance\./);
  assert.match(roadmap, /Conta e lifecycle foi iniciada/);
  assert.match(roadmap, /1\. ativar e validar o SMTP de verificação de e-mail em produção;/);
  assert.match(
    roadmap,
    /2\. validar em produção a recuperação de senha e a invalidação segura de sessões;/
  );
  assert.match(roadmap, /fluxo seguro, sessão revogável, UI e runbook versionados/);
});
