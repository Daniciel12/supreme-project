"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import styles from "./login-v3.module.css";

type Mode = "login" | "register";

const oauthErrorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    "Já existe uma conta com este e-mail usando outro método de acesso. Entre com o método original.",
  AccessDenied: "O acesso com Google foi cancelado ou negado.",
};

function oauthErrorMessage(code: string | null) {
  if (!code) return null;
  return (
    oauthErrorMessages[code] ??
    "Não foi possível concluir o acesso com Google. Tente novamente."
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectError = oauthErrorMessage(searchParams.get("error"));
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null | undefined>(undefined);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const visibleError = error === undefined ? redirectError : error;

  useEffect(() => {
    let active = true;

    void getProviders()
      .then((providers) => {
        if (active) {
          setGoogleAvailable(Boolean(providers?.google));
        }
      })
      .catch(() => {
        if (active) {
          setGoogleAvailable(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function authenticate() {
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.error === "TooManyRequests"
            ? "Muitas tentativas. Tente novamente mais tarde."
            : "E-mail ou senha inválidos."
        );
        setLoading(false);
        return;
      }

      if (!result?.ok) {
        throw new Error("Authentication did not complete.");
      }

      window.location.replace("/");
    } catch (err) {
      console.error("Erro ao autenticar", err);
      setError("Não foi possível entrar. Tente novamente.");
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    await authenticate();
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao cadastrar.");
        setLoading(false);
        return;
      }

      await authenticate();
    } catch (err) {
      console.error("Erro ao cadastrar", err);
      setError("Erro ao cadastrar.");
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);

    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (err) {
      console.error("Erro ao autenticar com Google", err);
      setError("Não foi possível entrar com Google.");
      setLoading(false);
    }
  }

  function switchMode(nextMode: Mode) {
    setError(null);
    setMode(nextMode);
  }

  return (
    <main className={`${styles.page} main-content`}>
      <section className={styles.frame} aria-label="Acesso ao Supreme">
        <div className={styles.story}>
          <span className={styles.storyGlow} aria-hidden="true" />

          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              S
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>Supreme</span>
              <span className={styles.brandCaption}>Seu sistema pessoal</span>
            </span>
          </div>

          <div className={styles.storyContent}>
            <p className={styles.eyebrow}>Evolução pessoal, organizada</p>
            <h2 className={styles.storyTitle}>Sua vida, em um sistema.</h2>
            <p className={styles.storyDescription}>
              Reúna finanças, metas, hábitos, treinos, livros e visão pessoal em
              uma experiência construída para acompanhar sua evolução.
            </p>
          </div>

          <div className={styles.capabilities} aria-label="Recursos do Supreme">
            <p className={styles.capability}>
              <span className={styles.capabilityMark} aria-hidden="true">✓</span>
              Finanças, metas e hábitos no mesmo lugar
            </p>
            <p className={styles.capability}>
              <span className={styles.capabilityMark} aria-hidden="true">✓</span>
              Treinos, livros e evolução acompanhados no tempo
            </p>
            <p className={styles.capability}>
              <span className={styles.capabilityMark} aria-hidden="true">✓</span>
              Experiência pessoal com dados isolados por conta
            </p>
          </div>
        </div>

        <div className={styles.authPanel}>
          <div className={`${styles.authCard} card auth-wrapper`}>
            <p className={styles.modePill}>
              {mode === "login" ? "Acesso seguro" : "Comece sua jornada"}
            </p>
            <h1 className={`${styles.title} auth-title`}>
              {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
            </h1>
            <p className={styles.subtitle}>
              {mode === "login"
                ? "Entre para continuar de onde parou."
                : "Cadastre-se para começar a organizar sua evolução."}
            </p>

            <form
              className={`${styles.form} form`}
              onSubmit={mode === "login" ? handleLogin : handleRegister}
            >
              {mode === "register" && (
                <div className={styles.field}>
                  <label className={`${styles.label} form-label`} htmlFor="name">
                    Nome
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    className={`${styles.input} input`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              )}

              <div className={styles.field}>
                <label className={`${styles.label} form-label`} htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={`${styles.input} input`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label
                  className={`${styles.label} form-label`}
                  htmlFor="password"
                >
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={`${styles.input} input`}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              {visibleError && (
                <p
                  className={`${styles.error} error-text`}
                  role="alert"
                  aria-live="polite"
                >
                  {visibleError}
                </p>
              )}

              <button
                type="submit"
                className={`${styles.submit} btn btn-primary`}
                disabled={loading}
              >
                {loading
                  ? "Aguarde..."
                  : mode === "login"
                    ? "Entrar no Supreme"
                    : "Criar minha conta"}
              </button>
            </form>

            {googleAvailable && (
              <div className={`${styles.oauth} oauth-section`}>
                <div className={`${styles.divider} auth-divider`}>
                  <span>ou continue com</span>
                </div>
                <button
                  type="button"
                  className={`${styles.googleButton} btn btn-outline oauth-button`}
                  disabled={loading}
                  onClick={handleGoogleLogin}
                >
                  Continuar com Google
                </button>
              </div>
            )}

            <p className={`${styles.footer} auth-footer`}>
              {mode === "login" ? (
                <>
                  Ainda não tem conta?{" "}
                  <button
                    type="button"
                    className={`${styles.switchButton} link-button`}
                    onClick={() => switchMode("register")}
                  >
                    Cadastre-se
                  </button>
                </>
              ) : (
                <>
                  Já tem uma conta?{" "}
                  <button
                    type="button"
                    className={`${styles.switchButton} link-button`}
                    onClick={() => switchMode("login")}
                  >
                    Entrar
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className={styles.fallback} />}>
      <LoginContent />
    </Suspense>
  );
}
