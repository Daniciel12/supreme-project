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
    [
      "/",
      "/habitos",
      "/financas",
      "/metas",
      "/livros",
      "/treinos",
      "/visao",
      "/configuracoes",
    ]
  );
});

test("active navigation matches route boundaries without prefix collisions", () => {
  assert.equal(isActivePath("/", "/"), true);
  assert.equal(isActivePath("/habitos", "/habitos"), true);
  assert.equal(isActivePath("/financas", "/financas"), true);
  assert.equal(isActivePath("/financas/contas", "/financas"), true);
  assert.equal(isActivePath("/financas-extra", "/financas"), false);
  assert.equal(isActivePath("/livros", "/livros"), true);
  assert.equal(isActivePath("/configuracoes", "/configuracoes"), true);
  assert.equal(isActivePath("/login", "/"), false);
});

test("application shell keeps semantic landmarks and accessible mobile controls", () => {
  const shell = read("src/components/application-shell.tsx");

  assert.match(shell, /<aside/);
  assert.match(shell, /<nav[^>]+aria-label="Navegação principal"/);
  assert.match(shell, /<header/);
  assert.match(shell, /aria-expanded=\{menuOpen\}/);
  assert.match(shell, /aria-controls="supreme-sidebar"/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /event\.key !== "Tab"/);
  assert.match(shell, /sidebarCloseButtonRef/);
  assert.match(shell, /document\.body\.style\.overflow = "hidden"/);
  assert.match(shell, /window\.matchMedia\("\(max-width: 800px\)"\)/);
  assert.match(shell, /role=\{menuOpen \? "dialog" : undefined\}/);
  assert.match(shell, /aria-modal=\{menuOpen \? true : undefined\}/);
  assert.match(shell, /aria-label="Menu principal"/);
  assert.match(shell, /aria-label="Fechar menu"/);
  assert.match(shell, /closeMenu\(\{ restoreFocus: true \}\)/);
  assert.match(shell, /closeMenu\(\{ restoreFocus: menuOpen \}\)/);
  assert.match(shell, /pathname === "\/login"/);
});

test("mobile shell keeps navigation reachable on short and notched screens", () => {
  const globals = read("src/app/globals.css");
  const styles = read("src/components/application-shell-v3.module.css");

  assert.match(globals, /overflow-y:\s*auto/);
  assert.match(globals, /overscroll-behavior:\s*contain/);
  assert.match(globals, /env\(safe-area-inset-top\)/);
  assert.match(globals, /env\(safe-area-inset-bottom\)/);
  assert.match(globals, /\.app-header__menu\s*\{[^}]*width:\s*44px/s);
  assert.match(globals, /\.app-nav__link\s*\{[^}]*min-height:\s*48px/s);
  assert.match(styles, /\.sidebarCloseButton/);
  assert.match(styles, /width:\s*44px/);
  assert.match(styles, /height:\s*44px/);
});

test("application shell v3 is isolated and preserves legacy contracts", () => {
  const shell = read("src/components/application-shell.tsx");
  const styles = read("src/components/application-shell-v3.module.css");

  assert.match(shell, /application-shell-v3\.module\.css/);
  assert.match(shell, /className=\{`app-shell \$\{styles\.shell\}`\}/);
  assert.match(shell, /app-sidebar/);
  assert.match(shell, /app-nav__link/);
  assert.match(shell, /app-header__context/);
  assert.match(shell, /Workspace pessoal/);
  assert.match(shell, /window\.location\.replace\("\/login"\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /profileAvatar/);
  assert.match(styles, /navLinkActive/);
  assert.doesNotMatch(styles, /!important/);
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
