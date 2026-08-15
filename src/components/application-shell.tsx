"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSession, signOut } from "next-auth/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  applicationNavigation,
  isActivePath,
} from "@/components/application-navigation";
import styles from "./application-shell-v3.module.css";

type SessionUser = {
  name?: string | null;
  email?: string | null;
};

export function ApplicationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicAuthPage =
    pathname === "/login" || pathname === "/verificar-email";
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarCloseButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const mobileViewport = window.matchMedia("(max-width: 800px)");
    const previousOverflow = document.body.style.overflow;

    if (mobileViewport.matches) {
      document.body.style.overflow = "hidden";
      sidebarCloseButtonRef.current?.focus();
    }

    function handleViewportChange(event: MediaQueryListEvent) {
      if (!event.matches) setMenuOpen(false);
    }

    mobileViewport.addEventListener("change", handleViewportChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      mobileViewport.removeEventListener("change", handleViewportChange);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (isPublicAuthPage) return;

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
  }, [isPublicAuthPage, pathname]);

  function closeMenu({ restoreFocus = false } = {}) {
    setMenuOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  }

  function handleSidebarKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !menuOpen) return;

    const focusableElements = sidebarRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])'
    );
    if (!focusableElements?.length) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    try {
      await signOut({ redirect: false });
    } finally {
      window.location.replace("/login");
    }
  }

  if (isPublicAuthPage) return children;

  const navigationLinks = applicationNavigation.map((item) => {
    const active = isActivePath(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`app-nav__link ${styles.navLink}${
          active ? ` app-nav__link--active ${styles.navLinkActive}` : ""
        }`}
        aria-current={active ? "page" : undefined}
        onClick={() => closeMenu({ restoreFocus: menuOpen })}
      >
        <span className={`app-nav__icon ${styles.navIcon}`} aria-hidden="true">
          {item.shortLabel}
        </span>
        <span>{item.label}</span>
      </Link>
    );
  });

  const sessionLabel = sessionUser?.email ?? sessionUser?.name ?? "Área pessoal";
  const sessionInitial = (sessionUser?.name ?? sessionUser?.email ?? "S")
    .trim()
    .charAt(0) || "S";

  return (
    <div
      className={`app-shell ${styles.shell}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) closeMenu({ restoreFocus: true });
      }}
    >
      <a className="app-skip-link" href="#supreme-main-content">
        Pular para o conteúdo
      </a>

      <aside
        id="supreme-sidebar"
        ref={sidebarRef}
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen ? true : undefined}
        aria-label="Menu principal"
        onKeyDown={handleSidebarKeyDown}
        className={`app-sidebar ${styles.sidebar}${
          menuOpen ? " app-sidebar--open" : ""
        }`}
      >
        <div className={`app-brand ${styles.brand}`}>
          <span
            className={`app-brand__mark ${styles.brandMark}`}
            aria-hidden="true"
          >
            S
          </span>
          <div className={styles.brandMeta}>
            <span className={`app-brand__name ${styles.brandName}`}>Supreme</span>
            <span className={`app-brand__caption ${styles.brandCaption}`}>
              Seu sistema pessoal
            </span>
          </div>
          <button
            type="button"
            ref={sidebarCloseButtonRef}
            className={styles.sidebarCloseButton}
            aria-label="Fechar menu"
            onClick={() => closeMenu({ restoreFocus: true })}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <nav className={`app-nav ${styles.nav}`} aria-label="Navegação principal">
          {navigationLinks}
        </nav>
        <p className="app-sidebar__footer">Organize hoje. Evolua sempre.</p>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="app-shell__backdrop"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => closeMenu({ restoreFocus: true })}
        />
      )}

      <div className="app-shell__workspace">
        <header className={`app-header ${styles.header}`}>
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
          <Link href="/" className="app-header__brand">
            Supreme
          </Link>

          <Link
            href="/configuracoes"
            className={styles.profile}
            title={sessionLabel}
            aria-label={`Abrir configurações da conta de ${sessionLabel}`}
          >
            <span className={styles.profileAvatar} aria-hidden="true">
              {sessionInitial}
            </span>
            <span className={styles.profileText}>
              <span className={styles.profileEyebrow}>Workspace pessoal</span>
              <span className={`app-header__context ${styles.profileLabel}`}>
                {sessionLabel}
              </span>
            </span>
          </Link>

          <button
            type="button"
            className="ui-button ui-button--outline ui-button--sm"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            {signingOut ? "Saindo..." : "Sair"}
          </button>
        </header>
        <div
          id="supreme-main-content"
          className={`app-shell__content ${styles.content}`}
          tabIndex={-1}
        >
          <div key={pathname} className="app-route-transition">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
