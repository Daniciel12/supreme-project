"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";

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

  return (
    <main className="main-content">
      <div className="auth-wrapper">
        <div className="card">
          <h1 className="auth-title">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </h1>

          <form
            className="form"
            onSubmit={mode === "login" ? handleLogin : handleRegister}
          >
            {mode === "register" && (
              <div>
                <label className="form-label">Nome</label>
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="form-label">E-mail</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label">Senha</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {visibleError && <p className="error-text">{visibleError}</p>}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? "Aguarde..."
                : mode === "login"
                ? "Acessar"
                : "Cadastrar"}
            </button>
          </form>

          {googleAvailable && (
            <div className="oauth-section">
              <div className="auth-divider">
                <span>ou</span>
              </div>
              <button
                type="button"
                className="btn btn-outline oauth-button"
                disabled={loading}
                onClick={handleGoogleLogin}
              >
                Continuar com Google
              </button>
            </div>
          )}

          <p className="auth-footer">
            {mode === "login" ? (
              <>
                Não tem conta?{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setError(null);
                    setMode("register");
                  }}
                >
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setError(null);
                    setMode("login");
                  }}
                >
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="main-content" />}>
      <LoginContent />
    </Suspense>
  );
}
