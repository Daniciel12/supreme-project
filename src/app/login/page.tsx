"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
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
  const accountNotice = searchParams.has("emailChanged")
    ? "E-mail alterado com sucesso. Entre novamente usando o novo endereço."
    : searchParams.has("accountDeleted")
      ? "Sua conta e seus dados ativos foram excluídos com sucesso."
      : searchParams.has("deletionPending")
        ? "A limpeza externa não terminou. Entre novamente e repita a exclusão para concluir."
        : null;
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
          <span className={styles.storyOrbit} aria-hidden="true" />

          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              S
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>Supreme</span>
              <span className={styles.brandCaption}>Sistema pessoal de evolução</span>
            </span>
          </div>

          <div className={styles.storyContent}>
            <p className={styles.eyebrow}>Da intenção ao ritmo</p>
            <h2 className={styles.storyTitle}>
              Construa o dia que constrói você.
            </h2>
            <p className={styles.storyDescription}>
              O Supreme transforma prioridades dispersas em um sistema pessoal
              para decidir, agir e acompanhar sua evolução com clareza.
            </p>
          </div>

          <ol className={styles.journey} aria-label="Jornada no Supreme">
            <li className={styles.journeyStep}>
              <span className={styles.journeyIndex} aria-hidden="true">01</span>
              <span>
                <strong>Organize</strong>
                <small>Veja a realidade inteira.</small>
              </span>
            </li>
            <li className={styles.journeyStep}>
              <span className={styles.journeyIndex} aria-hidden="true">02</span>
              <span>
                <strong>Decida</strong>
                <small>Escolha o próximo passo.</small>
              </span>
            </li>
            <li className={styles.journeyStep}>
              <span className={styles.journeyIndex} aria-hidden="true">03</span>
              <span>
                <strong>Evolua</strong>
                <small>Transforme ação em ritmo.</small>
              </span>
            </li>
          </ol>
        </div>

        <div className={styles.authPanel}>
          <div className={`${styles.authCard} card auth-wrapper`}>
            <div className={styles.accessStatus}>
              <span>
                <span className={styles.statusDot} aria-hidden="true" />
                Espaço pessoal protegido
              </span>
              <span className={styles.accessCode}>SUPREME ID</span>
            </div>
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

            {accountNotice && (
              <p
                className={
                  searchParams.has("accountDeleted") ||
                  searchParams.has("emailChanged")
                    ? styles.success
                    : styles.error
                }
                role="status"
              >
                {accountNotice}
              </p>
            )}

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

              {mode === "login" && (
                <Link href="/recuperar-senha" className={styles.recoveryLink}>
                  Esqueci minha senha
                </Link>
              )}

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
                aria-busy={loading || undefined}
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
                  aria-busy={loading || undefined}
                >
                  <span className={styles.googleMark} aria-hidden="true">G</span>
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

            <p className={styles.privacyNote}>
              Autenticação protegida. Seus dados permanecem isolados por conta.
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
