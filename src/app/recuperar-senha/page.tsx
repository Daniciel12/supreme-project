"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "../auth-recovery.module.css";

type RequestState = "idle" | "submitting" | "success" | "error";

export default function PasswordRecoveryRequestPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;

    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/auth/password-recovery/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setState("error");
        setMessage(data.error ?? "Não foi possível processar a solicitação.");
        return;
      }

      setState("success");
      setMessage(data.message);
    } catch {
      setState("error");
      setMessage("Não foi possível processar a solicitação agora.");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="recovery-title">
        <div className={styles.brand} aria-label="Supreme">
          <span className={styles.brandMark} aria-hidden="true">S</span>
          <span>Supreme</span>
        </div>

        <p className={styles.eyebrow}>Supreme ID</p>
        <h1 id="recovery-title" className={styles.title}>
          Recupere seu acesso
        </h1>
        <p className={styles.description}>
          Informe o e-mail usado no cadastro. Por segurança, a resposta será a
          mesma exista ou não uma conta compatível.
        </p>

        <form className={styles.form} onSubmit={requestRecovery}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="recovery-email">
              E-mail
            </label>
            <input
              id="recovery-email"
              name="email"
              type="email"
              autoComplete="email"
              className={styles.input}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

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

          <button
            type="submit"
            className={styles.primaryAction}
            disabled={state === "submitting"}
            aria-busy={state === "submitting" || undefined}
          >
            {state === "submitting" ? "Enviando..." : "Enviar instruções"}
          </button>

          <Link href="/login" className={styles.secondaryAction}>
            Voltar ao login
          </Link>
        </form>

        <p className={styles.securityNote}>
          O Supreme nunca informa se um endereço está cadastrado e não altera
          sua senha nesta etapa.
        </p>
      </section>
    </main>
  );
}
