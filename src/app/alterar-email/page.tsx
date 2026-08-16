"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../verificar-email/verificar-email.module.css";

type ConfirmationState =
  | "loading"
  | "ready"
  | "submitting"
  | "success"
  | "error";

export default function ConfirmEmailChangePage() {
  const [token, setToken] = useState("");
  const [state, setState] = useState<ConfirmationState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const fragmentToken = fragment.get("token") ?? "";

    const cleanUrl = new URL(window.location.href);
    cleanUrl.hash = "";
    window.history.replaceState({}, "", cleanUrl);

    queueMicrotask(() => {
      if (!/^[A-Za-z0-9_-]{43}$/.test(fragmentToken)) {
        setState("error");
        setMessage("Este link de alteração não é válido.");
        return;
      }

      setToken(fragmentToken);
      setState("ready");
    });
  }, []);

  async function confirmChange() {
    if (!token || state === "submitting") return;

    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/account/email-change/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!response.ok) {
        setState("error");
        setMessage(data.error ?? "Não foi possível alterar o e-mail.");
        return;
      }

      setState("success");
      setMessage(
        "Seu e-mail foi alterado e todas as sessões anteriores foram encerradas."
      );
    } catch {
      setState("error");
      setMessage("Não foi possível alterar o e-mail agora.");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="email-change-title">
        <div className={styles.brand} aria-label="Supreme">
          <span className={styles.brandMark} aria-hidden="true">S</span>
          <span>Supreme</span>
        </div>

        <p className={styles.eyebrow}>Supreme ID</p>
        <h1 id="email-change-title" className={styles.title}>
          {state === "success" ? "E-mail alterado" : "Confirme o novo e-mail"}
        </h1>
        <p className={styles.description}>
          {state === "success"
            ? "Entre novamente usando o endereço confirmado."
            : "A conta só será atualizada depois desta confirmação explícita."}
        </p>

        {message && (
          <p
            className={`${styles.feedback} ${
              state === "success" ? styles.success : styles.error
            }`}
            role={state === "success" ? "status" : "alert"}
            aria-live="polite"
          >
            {message}
          </p>
        )}

        {state === "loading" ? (
          <p className={styles.loading} role="status">
            Preparando confirmação...
          </p>
        ) : state === "ready" || state === "submitting" ? (
          <button
            type="button"
            className={styles.primaryAction}
            onClick={confirmChange}
            disabled={state === "submitting"}
            aria-busy={state === "submitting" || undefined}
          >
            {state === "submitting" ? "Confirmando..." : "Confirmar novo e-mail"}
          </button>
        ) : (
          <Link
            href={state === "success" ? "/login?emailChanged=1" : "/login"}
            className={styles.primaryAction}
          >
            Voltar ao login
          </Link>
        )}

        <p className={styles.securityNote}>
          Abrir o link não altera a conta. O token é de uso único e expira em 60 minutos.
        </p>
      </section>
    </main>
  );
}
