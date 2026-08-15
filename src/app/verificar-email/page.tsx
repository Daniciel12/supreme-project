"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./verificar-email.module.css";

type ConfirmationState =
  | "loading"
  | "ready"
  | "submitting"
  | "success"
  | "error";

export default function EmailVerificationPage() {
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
        setMessage("Este link de verificação não é válido.");
        return;
      }

      setToken(fragmentToken);
      setState("ready");
    });
  }, []);

  async function confirmEmail() {
    if (!token || state === "submitting") return;

    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/auth/email-verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!response.ok) {
        setState("error");
        setMessage(data.error ?? "Não foi possível confirmar o e-mail.");
        return;
      }

      setState("success");
      setMessage("Seu e-mail foi verificado com sucesso.");
    } catch {
      setState("error");
      setMessage("Não foi possível confirmar o e-mail agora.");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="verification-title">
        <div className={styles.brand} aria-label="Supreme">
          <span className={styles.brandMark} aria-hidden="true">S</span>
          <span>Supreme</span>
        </div>

        <p className={styles.eyebrow}>Supreme ID</p>
        <h1 id="verification-title" className={styles.title}>
          {state === "success" ? "Identidade confirmada" : "Confirme seu e-mail"}
        </h1>
        <p className={styles.description}>
          {state === "success"
            ? "A verificação foi concluída. Você pode continuar usando sua conta normalmente."
            : "Para sua segurança, a confirmação só acontece depois que você acionar o botão abaixo."}
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
            onClick={confirmEmail}
            disabled={state === "submitting"}
            aria-busy={state === "submitting" || undefined}
          >
            {state === "submitting" ? "Confirmando..." : "Confirmar meu e-mail"}
          </button>
        ) : (
          <Link href={state === "success" ? "/configuracoes" : "/login"} className={styles.primaryAction}>
            {state === "success" ? "Ir para Configurações" : "Voltar ao login"}
          </Link>
        )}

        <p className={styles.securityNote}>
          Abrir o link não altera sua conta. O token é de uso único e expira em 24 horas.
        </p>
      </section>
    </main>
  );
}
