"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import styles from "./configuracoes.module.css";

interface AccountProfile {
  name: string;
  email: string;
  emailVerified: boolean;
  accessMethods: {
    credentials: boolean;
    google: boolean;
  };
}

type Feedback =
  | { tone: "success" | "error"; message: string }
  | null;

async function fetchProfile() {
  const response = await fetch("/api/account/profile", { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Erro ao carregar perfil.");
  }

  return data as AccountProfile;
}

export default function ConfiguracoesPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function retryProfile() {
    setLoading(true);
    setLoadError(false);

    try {
      const data = await fetchProfile();
      setProfile(data);
      setName(data.name);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetchProfile()
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setName(data.name);
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();

    setFeedback(null);
    setNameError(null);

    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setNameError("Use um nome entre 2 e 100 caracteres.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: data.error ?? "Não foi possível atualizar o perfil.",
        });
        return;
      }

      const updatedProfile = data as AccountProfile;
      setProfile(updatedProfile);
      setName(updatedProfile.name);
      setFeedback({ tone: "success", message: "Nome atualizado com sucesso." });
    } catch {
      setFeedback({
        tone: "error",
        message: "Não foi possível atualizar o perfil.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function requestEmailVerification() {
    if (!profile || profile.emailVerified || sendingVerification) return;

    setFeedback(null);
    setSendingVerification(true);

    try {
      const response = await fetch("/api/auth/email-verification/request", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: data.error ?? "Não foi possível enviar a verificação.",
        });
        return;
      }

      if (data.status === "already-verified") {
        setProfile({ ...profile, emailVerified: true });
        setFeedback({ tone: "success", message: "Seu e-mail já está verificado." });
        return;
      }

      setFeedback({
        tone: "success",
        message: "Enviamos um link de verificação. Ele expira em 24 horas.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Não foi possível enviar a verificação.",
      });
    } finally {
      setSendingVerification(false);
    }
  }

  const profileInitial = (profile?.name || profile?.email || "S")
    .trim()
    .charAt(0)
    .toUpperCase();
  const hasChanges = Boolean(profile && name.trim() !== profile.name);

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Conta e lifecycle"
          title="Sua identidade no Supreme"
          description="Revise como você aparece no produto e quais métodos de acesso já estão ligados à sua conta."
          actions={
            profile && (
              <Badge tone={profile.emailVerified ? "success" : "warning"}>
                {profile.emailVerified ? "E-mail verificado" : "Verificação pendente"}
              </Badge>
            )
          }
        />

        {loading ? (
          <LoadingState
            title="Carregando sua conta..."
            description="Buscando somente os dados necessários do seu perfil."
          />
        ) : loadError || !profile ? (
          <ErrorState
            title="Não foi possível carregar sua conta"
            description="Nenhum dado foi alterado. Tente novamente."
            action={<Button onClick={retryProfile}>Tentar novamente</Button>}
          />
        ) : (
          <>
            <Card className={styles.identityCard} elevated>
              <div className={styles.identityMark} aria-hidden="true">
                {profileInitial}
              </div>
              <div className={styles.identityCopy}>
                <span className={styles.identityEyebrow}>Identidade principal</span>
                <h2 className={styles.identityName}>
                  {profile.name || "Defina como quer ser chamado"}
                </h2>
                <p className={styles.identityEmail}>{profile.email}</p>
              </div>
              <div className={styles.identityStatus}>
                <span>Conta protegida por sessão</span>
                <strong>{profile.accessMethods.google ? "Google conectado" : "Acesso local"}</strong>
              </div>
            </Card>

            {feedback && (
              <p
                className={`${styles.feedback} ${
                  feedback.tone === "success"
                    ? styles.feedbackSuccess
                    : styles.feedbackError
                }`}
                role={feedback.tone === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                {feedback.message}
              </p>
            )}

            <div className={styles.settingsGrid}>
              <Card aria-labelledby="profile-settings-title">
                <span className={styles.sectionIndex} aria-hidden="true">01</span>
                <h2 id="profile-settings-title" className="card-title">
                  Perfil
                </h2>
                <p className={styles.sectionDescription}>
                  O nome pode ser alterado aqui. O e-mail permanece bloqueado enquanto o fluxo seguro de troca de identidade não estiver disponível.
                </p>

                <form className="form" onSubmit={handleSubmit} noValidate>
                  <FormField
                    label="Nome de exibição"
                    htmlFor="account-name"
                    hint="Entre 2 e 100 caracteres."
                    error={nameError}
                  >
                    <Input
                      id="account-name"
                      name="name"
                      value={name}
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                      required
                      disabled={saving}
                      hasError={Boolean(nameError)}
                      aria-describedby={
                        nameError ? "account-name-error" : "account-name-hint"
                      }
                      onChange={(event) => {
                        setName(event.target.value);
                        setNameError(null);
                        setFeedback(null);
                      }}
                    />
                  </FormField>

                  <FormField
                    label="E-mail da conta"
                    htmlFor="account-email"
                    hint="A troca de e-mail exigirá confirmação de identidade em uma etapa futura."
                  >
                    <Input
                      id="account-email"
                      value={profile.email}
                      readOnly
                      aria-readonly="true"
                      aria-describedby="account-email-hint"
                    />
                  </FormField>

                  {!profile.emailVerified && (
                    <div className={styles.verificationAction}>
                      <div>
                        <strong>Verificação pendente</strong>
                        <span>O link é enviado somente para o e-mail desta conta.</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        isLoading={sendingVerification}
                        loadingLabel="Enviando..."
                        onClick={requestEmailVerification}
                      >
                        Enviar verificação
                      </Button>
                    </div>
                  )}

                  <Button
                    type="submit"
                    isLoading={saving}
                    loadingLabel="Salvando..."
                    disabled={!hasChanges}
                  >
                    Salvar nome
                  </Button>
                </form>
              </Card>

              <Card aria-labelledby="access-methods-title">
                <span className={styles.sectionIndex} aria-hidden="true">02</span>
                <h2 id="access-methods-title" className="card-title">
                  Métodos de acesso
                </h2>
                <p className={styles.sectionDescription}>
                  Esta visão é somente informativa. O Supreme não vincula contas automaticamente.
                </p>

                <ul className={styles.accessList}>
                  <li>
                    <div>
                      <strong>Google</strong>
                      <span>Entrada por OAuth com consentimento do Google.</span>
                    </div>
                    <Badge tone={profile.accessMethods.google ? "success" : "neutral"}>
                      {profile.accessMethods.google ? "Conectado" : "Não conectado"}
                    </Badge>
                  </li>
                  <li>
                    <div>
                      <strong>E-mail e senha</strong>
                      <span>Acesso tradicional protegido por hash de senha.</span>
                    </div>
                    <Badge tone={profile.accessMethods.credentials ? "success" : "neutral"}>
                      {profile.accessMethods.credentials ? "Ativo" : "Não configurado"}
                    </Badge>
                  </li>
                </ul>
              </Card>

              <Card className={styles.lifecycleCard} aria-labelledby="lifecycle-title">
                <span className={styles.sectionIndex} aria-hidden="true">03</span>
                <h2 id="lifecycle-title" className="card-title">
                  Próximas proteções
                </h2>
                <p className={styles.sectionDescription}>
                  Verificação de e-mail já possui confirmação explícita. Recuperação de senha, exportação e exclusão de conta continuam em fluxos separados, com políticas próprias.
                </p>
                <ul className={styles.lifecycleList}>
                  <li>nenhuma exclusão é executada nesta página;</li>
                  <li>tokens de verificação expiram e funcionam uma única vez;</li>
                  <li>métodos Google e Credentials continuam independentes.</li>
                </ul>
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
