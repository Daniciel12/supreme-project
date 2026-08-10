"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  applicationNavigation,
  isActivePath,
} from "@/components/application-navigation";

type SessionUser = {
  name?: string | null;
  email?: string | null;
};

export function ApplicationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menuOpen) sidebarRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (pathname === "/login") {
      setSessionUser(null);
      return;
    }

    let active = true;

    void getSession()
      .then((session) => {
        if (active) setSessionUser(session?.user ?? null);
      })
      .catch(() => {
        if (active) setSessionUser(null);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  function closeMenu({ restoreFocus = false } = {}) {
    setMenuOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    try {
      await signOut({ redirect: false });
    } finally {
      // Uma navegação de documento completo elimina estado e cache do cliente
      // associados à identidade anterior antes de outro login.
      window.location.replace("/login");
    }
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

  const sessionLabel = sessionUser?.email ?? sessionUser?.name ?? "Área pessoal";

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
          <span className="app-header__context" title={sessionLabel}>{sessionLabel}</span>
          <button
            type="button"
            className="ui-button ui-button--outline ui-button--sm"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            {signingOut ? "Saindo..." : "Sair"}
          </button>
        </header>
        <div className="app-shell__content">{children}</div>
      </div>
    </div>
  );
}
