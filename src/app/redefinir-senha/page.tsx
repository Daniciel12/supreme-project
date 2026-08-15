"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "../auth-recovery.module.css";

type ResetState = "loading" | "ready" | "submitting" | "success" | "error";

export default function PasswordResetPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [state, setState] = useState<ResetState>("loading");
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
        setMessage("Este link de recuperação não é válido.");
        return;
      }

      setToken(fragmentToken);
      setState("ready");
    });
  }, []);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || state === "submitting") return;

    if (password !== passwordConfirmation) {
      setState("error");
      setMessage("As senhas não coincidem.");
      return;
    }

    const passwordBytes = new TextEncoder().encode(password).length;
    if (password.length < 6 || passwordBytes > 72) {
      setState("error");
      setMessage("Use uma senha entre 6 caracteres e 72 bytes.");
      return;
    }

    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/auth/password-recovery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setState("error");
        setMessage(data.error ?? "Não foi possível redefinir a senha.");
        return;
      }

      setToken("");
      setPassword("");
      setPasswordConfirmation("");
      setState("success");
      setMessage(
        "Senha redefinida. As sessões anteriores foram encerradas; entre novamente."
      );
    } catch {
      setState("error");
      setMessage("Não foi possível redefinir a senha agora.");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="reset-title">
        <div className={styles.brand} aria-label="Supreme">
          <span className={styles.brandMark} aria-hidden="true">S</span>
          <span>Supreme</span>
        </div>

        <p className={styles.eyebrow}>Supreme ID</p>
        <h1 id="reset-title" className={styles.title}>
          {state === "success" ? "Acesso renovado" : "Crie uma nova senha"}
        </h1>
        <p className={styles.description}>
          {state === "success"
            ? "Sua credencial foi atualizada com segurança."
            : "Use uma senha exclusiva. A alteração encerrará as sessões anteriores da conta."}
        </p>

        {state === "loading" ? (
          <p className={styles.securityNote} role="status">
            Preparando recuperação...
          </p>
        ) : state === "success" ? (
          <div className={styles.form}>
            <p className={`${styles.feedback} ${styles.success}`} role="status">
              {message}
            </p>
            <Link href="/login" className={styles.primaryAction}>
              Entrar com a nova senha
            </Link>
          </div>
        ) : (
          <form className={styles.form} onSubmit={resetPassword}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-password">
                Nova senha
              </label>
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                className={styles.input}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
                disabled={state === "error" && !token}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirm-password">
                Confirme a nova senha
              </label>
              <input
                id="confirm-password"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                className={styles.input}
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                minLength={6}
                required
                disabled={state === "error" && !token}
              />
            </div>

            {message && (
              <p
                className={`${styles.feedback} ${styles.error}`}
                role="alert"
                aria-live="polite"
              >
                {message}
              </p>
            )}

            {token ? (
              <button
                type="submit"
                className={styles.primaryAction}
                disabled={state === "submitting"}
                aria-busy={state === "submitting" || undefined}
              >
                {state === "submitting" ? "Redefinindo..." : "Redefinir senha"}
              </button>
            ) : (
              <Link href="/recuperar-senha" className={styles.primaryAction}>
                Solicitar novo link
              </Link>
            )}

            <Link href="/login" className={styles.secondaryAction}>
              Voltar ao login
            </Link>
          </form>
        )}

        <p className={styles.securityNote}>
          O token é de uso único, não aparece nos logs de acesso e expira em 60 minutos.
        </p>
      </section>
    </main>
  );
}
