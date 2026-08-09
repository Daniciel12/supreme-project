"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  applicationNavigation,
  isActivePath,
} from "@/components/application-navigation";

export function ApplicationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menuOpen) sidebarRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [menuOpen]);

  function closeMenu({ restoreFocus = false } = {}) {
    setMenuOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }

  if (pathname === "/login") return children;

  const navigationLinks = applicationNavigation.map((item) => {
    const active = isActivePath(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`app-nav__link${active ? " app-nav__link--active" : ""}`}
        aria-current={active ? "page" : undefined}
        onClick={() => closeMenu()}
      >
        <span className="app-nav__icon" aria-hidden="true">{item.shortLabel}</span>
        <span>{item.label}</span>
      </Link>
    );
  });

  return (
    <div
      className="app-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) closeMenu({ restoreFocus: true });
      }}
    >
      <aside
        id="supreme-sidebar"
        ref={sidebarRef}
        className={`app-sidebar${menuOpen ? " app-sidebar--open" : ""}`}
      >
        <div className="app-brand">
          <span className="app-brand__mark" aria-hidden="true">S</span>
          <div>
            <span className="app-brand__name">Supreme</span>
            <span className="app-brand__caption">Seu sistema pessoal</span>
          </div>
        </div>
        <nav className="app-nav" aria-label="Navegação principal">{navigationLinks}</nav>
        <p className="app-sidebar__footer">Organize hoje. Evolua sempre.</p>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="app-shell__backdrop"
          aria-label="Fechar menu"
          onClick={() => closeMenu({ restoreFocus: true })}
        />
      )}

      <div className="app-shell__workspace">
        <header className="app-header">
          <button
            type="button"
            ref={menuButtonRef}
            className="app-header__menu"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="supreme-sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
          </button>
          <Link href="/" className="app-header__brand">Supreme</Link>
          <span className="app-header__context">Área pessoal</span>
        </header>
        <div className="app-shell__content">{children}</div>
      </div>
    </div>
  );
}
