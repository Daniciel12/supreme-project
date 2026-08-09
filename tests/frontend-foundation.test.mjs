import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applicationNavigation,
  isActivePath,
} from "../src/components/application-navigation.ts";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("application navigation covers every existing authenticated module", () => {
  assert.deepEqual(
    applicationNavigation.map(({ href }) => href),
    ["/", "/habitos", "/financas", "/metas", "/livros", "/treinos", "/visao"]
  );
});

test("active navigation matches route boundaries without prefix collisions", () => {
  assert.equal(isActivePath("/", "/"), true);
  assert.equal(isActivePath("/habitos", "/habitos"), true);
  assert.equal(isActivePath("/financas", "/financas"), true);
  assert.equal(isActivePath("/financas/contas", "/financas"), true);
  assert.equal(isActivePath("/financas-extra", "/financas"), false);
  assert.equal(isActivePath("/livros", "/livros"), true);
  assert.equal(isActivePath("/login", "/"), false);
});

test("application shell keeps semantic landmarks and accessible mobile controls", () => {
  const shell = read("src/components/application-shell.tsx");

  assert.match(shell, /<aside/);
  assert.match(shell, /<nav[^>]+aria-label="Navegação principal"/);
  assert.match(shell, /<header/);
  assert.match(shell, /aria-expanded=\{menuOpen\}/);
  assert.match(shell, /aria-controls="supreme-sidebar"/);
  assert.match(shell, /pathname === "\/login"/);
});

test("foundation workspaces consume shared components instead of duplicating primitives", () => {
  for (const page of ["src/app/habitos/page.tsx", "src/app/financas/page.tsx"]) {
    const source = read(page);
    assert.match(source, /PageHeader/);
    assert.match(source, /LoadingState/);
    assert.match(source, /EmptyState/);
    assert.match(source, /ErrorState/);
    assert.match(source, /FormField/);
  }
});

test("dashboard uses the foundation and habits retain their own workspace", () => {
  const dashboard = read("src/app/page.tsx");
  const habits = read("src/app/habitos/page.tsx");

  assert.match(dashboard, /\/api\/dashboard/);
  assert.match(dashboard, /PageHeader/);
  assert.match(dashboard, /LoadingState/);
  assert.match(dashboard, /EmptyState/);
  assert.match(dashboard, /ErrorState/);
  assert.match(dashboard, /Card/);
  assert.match(habits, /\/api\/habits/);
  assert.match(habits, /\/api\/checkins/);
});
