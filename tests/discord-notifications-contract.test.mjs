import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Discord notifications prioritize team-friendly Portuguese summaries", () => {
  const workflow = read(".github/workflows/discord-notify.yml");

  assert.match(workflow, /Resumo para o time/);
  assert.match(workflow, /Impacto/);
  assert.match(workflow, /Próximo passo/);
  assert.match(workflow, /Nova atualização em desenvolvimento/);
  assert.match(workflow, /Atualização pronta para revisão/);
  assert.match(workflow, /Atualização concluída/);
  assert.match(workflow, /Verificações automáticas aprovadas/);
  assert.match(workflow, /embeds:/);
  assert.match(workflow, /allowed_mentions/);
});

test("pull request template provides the sections consumed by Discord", () => {
  const template = read(".github/pull_request_template.md");

  assert.match(template, /^## Resumo para o time$/m);
  assert.match(template, /^## Impacto$/m);
  assert.match(template, /sem jargão técnico/i);
});
