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
  assert.match(workflow, /Verificações aprovadas/);
  assert.match(workflow, /Supreme • Atualização #\$\{PR_NUMBER\}/);
  assert.match(workflow, /Supreme • Verificação automática/);
  assert.doesNotMatch(workflow, /FOOTER="Supreme • PR/);
  assert.doesNotMatch(workflow, /FOOTER="Supreme • CI/);
  assert.match(workflow, /embeds:/);
  assert.match(workflow, /allowed_mentions/);
});

test("pull request template provides concise sections consumed by Discord", () => {
  const template = read(".github/pull_request_template.md");

  assert.match(template, /^## Resumo para o time$/m);
  assert.match(template, /^## Impacto$/m);
  assert.match(template, /sem jargão técnico/i);
  assert.match(template, /1 ou 2 frases curtas/i);
  assert.doesNotMatch(template, /Descreva aqui a mudança em linguagem simples/);
  assert.doesNotMatch(template, /Descreva aqui o impacto esperado/);
});

test("Discord documentation matches the concise PR guidance", () => {
  const documentation = read("docs/DISCORD_INTEGRATION.md");

  assert.match(documentation, /1 ou 2 frases curtas/i);
  assert.doesNotMatch(documentation, /1 a 3 frases/i);
  assert.match(documentation, /without visible placeholder text/i);
});
