"use client";

import { FormEvent, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
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

const ACCOUNT_DELETION_CONFIRMATION = "EXCLUIR MINHA CONTA";

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
  const [exportingData, setExportingData] = useState(false);
  const [showDeletionForm, setShowDeletionForm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletionEmail, setDeletionEmail] = useState("");
  const [deletionPhrase, setDeletionPhrase] = useState("");
  const [deletionPassword, setDeletionPassword] = useState("");
  const [acknowledgedBackupRetention, setAcknowledgedBackupRetention] =
    useState(false);
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

  async function exportAccountData() {
    if (exportingData) return;

    setFeedback(null);
    setExportingData(true);

    try {
      const response = await fetch("/api/account/export", { method: "POST" });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setFeedback({
          tone: "error",
          message: data?.error ?? "Não foi possível exportar seus dados.",
        });
        return;
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const responseFilename = disposition.match(
        /filename="(supreme-export-\d{4}-\d{2}-\d{2}\.json)"/
      )?.[1];
      const filename = responseFilename ?? "supreme-export.json";
      const downloadUrl = URL.createObjectURL(await response.blob());
      const download = document.createElement("a");
      download.href = downloadUrl;
      download.download = filename;
      document.body.append(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);

      setFeedback({
        tone: "success",
        message: "Exportação concluída. O arquivo foi salvo no seu dispositivo.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Não foi possível exportar seus dados.",
      });
    } finally {
      setExportingData(false);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || deletingAccount) return;

    setFeedback(null);

    if (
      deletionEmail.trim().toLowerCase() !== profile.email.toLowerCase() ||
      deletionPhrase !== ACCOUNT_DELETION_CONFIRMATION ||
      !acknowledgedBackupRetention ||
      (profile.accessMethods.credentials && !deletionPassword)
    ) {
      setFeedback({
        tone: "error",
        message: "Preencha todas as confirmações exatamente como solicitado.",
      });
      return;
    }

    setDeletingAccount(true);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: deletionEmail,
          confirmation: deletionPhrase,
          acknowledgedBackupRetention,
          ...(profile.accessMethods.credentials
            ? { password: deletionPassword }
            : {}),
        }),
      });
      const data = await response.json().catch(() => null);

      if (response.ok) {
        try {
          await signOut({ redirect: false });
        } finally {
          window.location.replace("/login?accountDeleted=1");
        }
        return;
      }

      if (response.status === 428) {
        setFeedback({
          tone: "error",
          message:
            "Sua autenticação está antiga. Saia, entre novamente com Google e repita a confirmação.",
        });
        return;
      }

      if (response.status === 503) {
        try {
          await signOut({ redirect: false });
        } finally {
          window.location.replace("/login?deletionPending=1");
        }
        return;
      }

      setFeedback({
        tone: "error",
        message: data?.error ?? "Não foi possível excluir sua conta.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "Não foi possível excluir sua conta.",
      });
    } finally {
      setDeletingAccount(false);
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

              <Card className={styles.lifecycleCard} aria-labelledby="data-export-title">
                <span className={styles.sectionIndex} aria-hidden="true">03</span>
                <h2 id="data-export-title" className="card-title">
                  Seus dados
                </h2>
                <p className={styles.sectionDescription}>
                  Baixe uma cópia portátil dos dados da sua conta e dos módulos do Supreme. Senhas, sessões e tokens nunca entram no arquivo.
                </p>
                <div className={styles.exportAction}>
                  <div>
                    <strong>Arquivo JSON</strong>
                    <span>Inclui perfil, hábitos, metas, treinos, evolução, finanças, livros e referências da Visão.</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={exportingData}
                    loadingLabel="Preparando..."
                    onClick={exportAccountData}
                  >
                    Exportar meus dados
                  </Button>
                </div>
              </Card>

              <Card className={styles.lifecycleCard} aria-labelledby="lifecycle-title">
                <span className={styles.sectionIndex} aria-hidden="true">04</span>
                <h2 id="lifecycle-title" className="card-title">
                  Proteções do ciclo de dados
                </h2>
                <p className={styles.sectionDescription}>
                  O Supreme separa exportação, exclusão e recuperação para reduzir ações acidentais. A troca segura de e-mail continua no roadmap.
                </p>
                <ul className={styles.lifecycleList}>
                  <li>a exportação não inclui credenciais nem arquivos de sessão;</li>
                  <li>a exclusão exige identidade confirmada e revoga as sessões;</li>
                  <li>backups criptografados podem reter dados por até 30 dias.</li>
                </ul>
              </Card>

              <Card
                className={`${styles.lifecycleCard} ${styles.dangerCard}`}
                aria-labelledby="account-deletion-title"
              >
                <span className={styles.dangerIndex} aria-hidden="true">05</span>
                <h2 id="account-deletion-title" className="card-title">
                  Excluir minha conta
                </h2>
                <p className={styles.sectionDescription}>
                  Esta ação apaga permanentemente sua conta, os dados dos módulos e os arquivos reconhecidos no provedor de uploads. Exporte seus dados antes de continuar.
                </p>

                {!showDeletionForm ? (
                  <div className={styles.dangerSummary}>
                    <div>
                      <strong>Ação irreversível na aplicação</strong>
                      <span>
                        Cópias em backups externos criptografados expiram pela política operacional em até 30 dias e não são restauradas automaticamente.
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        setShowDeletionForm(true);
                        setDeletionEmail("");
                        setFeedback(null);
                      }}
                    >
                      Iniciar exclusão
                    </Button>
                  </div>
                ) : (
                  <form className={styles.deletionForm} onSubmit={deleteAccount}>
                    <div className={styles.deletionWarning} role="note">
                      <strong>Antes de confirmar</strong>
                      <span>
                        Confira sua exportação. Depois da conclusão, você será desconectado e não poderá recuperar a conta pela aplicação.
                      </span>
                    </div>

                    <FormField
                      label="Confirme o e-mail da conta"
                      htmlFor="account-deletion-email"
                      hint={`Digite exatamente ${profile.email}.`}
                    >
                      <Input
                        id="account-deletion-email"
                        type="email"
                        autoComplete="email"
                        value={deletionEmail}
                        required
                        disabled={deletingAccount}
                        onChange={(event) => setDeletionEmail(event.target.value)}
                      />
                    </FormField>

                    {profile.accessMethods.credentials ? (
                      <FormField
                        label="Senha atual"
                        htmlFor="account-deletion-password"
                        hint="A senha é validada no servidor e não é armazenada novamente."
                      >
                        <Input
                          id="account-deletion-password"
                          type="password"
                          autoComplete="current-password"
                          value={deletionPassword}
                          required
                          maxLength={72}
                          disabled={deletingAccount}
                          onChange={(event) =>
                            setDeletionPassword(event.target.value)
                          }
                        />
                      </FormField>
                    ) : (
                      <p className={styles.oauthConfirmation}>
                        Como esta conta usa Google, a exclusão exige um login realizado nos últimos 10 minutos.
                      </p>
                    )}

                    <FormField
                      label={`Digite ${ACCOUNT_DELETION_CONFIRMATION}`}
                      htmlFor="account-deletion-confirmation"
                      hint="A frase diferencia esta ação de um clique acidental."
                    >
                      <Input
                        id="account-deletion-confirmation"
                        value={deletionPhrase}
                        required
                        disabled={deletingAccount}
                        onChange={(event) => setDeletionPhrase(event.target.value)}
                      />
                    </FormField>

                    <label className={styles.retentionAcknowledgement}>
                      <input
                        type="checkbox"
                        checked={acknowledgedBackupRetention}
                        required
                        disabled={deletingAccount}
                        onChange={(event) =>
                          setAcknowledgedBackupRetention(event.target.checked)
                        }
                      />
                      <span>
                        Entendo que backups externos criptografados podem manter cópias por até 30 dias, sem restauração automática da minha conta.
                      </span>
                    </label>

                    <div className={styles.deletionActions}>
                      <Button
                        type="submit"
                        variant="danger"
                        isLoading={deletingAccount}
                        loadingLabel="Excluindo..."
                      >
                        Excluir conta permanentemente
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={deletingAccount}
                        onClick={() => {
                          setShowDeletionForm(false);
                          setDeletionEmail("");
                          setDeletionPhrase("");
                          setDeletionPassword("");
                          setAcknowledgedBackupRetention(false);
                          setFeedback(null);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
