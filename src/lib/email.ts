import "server-only";

import nodemailer from "secure-nodemailer";

const SMTP_TIMEOUT_MS = 10_000;

interface EmailEnvironment {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  EMAIL_FROM?: string;
}

export interface EmailTransportConfiguration {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

function currentEmailEnvironment(): EmailEnvironment {
  return {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };
}

function requiredValue(value: string | undefined, name: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new EmailConfigurationError(`${name} is not configured.`);
  }
  return normalized;
}

function requiredSecret(value: string | undefined, name: string) {
  if (!value) {
    throw new EmailConfigurationError(`${name} is not configured.`);
  }
  return value;
}

export function readEmailTransportConfiguration(
  environment: EmailEnvironment = currentEmailEnvironment()
): EmailTransportConfiguration {
  const host = requiredValue(environment.SMTP_HOST, "SMTP_HOST");
  const portValue = requiredValue(environment.SMTP_PORT, "SMTP_PORT");
  const secureValue = requiredValue(environment.SMTP_SECURE, "SMTP_SECURE");
  const user = requiredValue(environment.SMTP_USER, "SMTP_USER");
  const password = requiredSecret(environment.SMTP_PASSWORD, "SMTP_PASSWORD");
  const from = requiredValue(environment.EMAIL_FROM, "EMAIL_FROM");
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new EmailConfigurationError("SMTP_PORT must be a valid TCP port.");
  }

  if (secureValue !== "true" && secureValue !== "false") {
    throw new EmailConfigurationError(
      "SMTP_SECURE must be exactly true or false."
    );
  }

  if (/\r|\n/.test(from) || from.length > 320) {
    throw new EmailConfigurationError("EMAIL_FROM is invalid.");
  }

  return {
    host,
    port,
    secure: secureValue === "true",
    user,
    password,
    from,
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character
  );
}

async function sendTransactionalEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const configuration = readEmailTransportConfiguration();
  const transporter = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    requireTLS: !configuration.secure,
    auth: {
      user: configuration.user,
      pass: configuration.password,
    },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: {
      minVersion: "TLSv1.2",
    },
  });

  await transporter.sendMail({
    from: configuration.from,
    to,
    subject,
    text,
    html,
  });
}

export async function sendEmailVerification({
  to,
  verificationUrl,
}: {
  to: string;
  verificationUrl: string;
}) {
  const safeUrl = escapeHtml(verificationUrl);

  await sendTransactionalEmail({
    to,
    subject: "Confirme seu e-mail no Supreme",
    text: [
      "Confirme que este e-mail pertence à sua conta Supreme.",
      "",
      verificationUrl,
      "",
      "O link expira em 24 horas e só funciona uma vez.",
      "Se você não solicitou esta verificação, ignore esta mensagem.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717">
        <h1 style="font-size:22px">Confirme seu e-mail</h1>
        <p>Confirme que este e-mail pertence à sua conta Supreme.</p>
        <p><a href="${safeUrl}">Confirmar e-mail</a></p>
        <p>O link expira em 24 horas e só funciona uma vez.</p>
        <p>Se você não solicitou esta verificação, ignore esta mensagem.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}) {
  const safeUrl = escapeHtml(resetUrl);

  await sendTransactionalEmail({
    to,
    subject: "Redefina sua senha do Supreme",
    text: [
      "Recebemos uma solicitação para redefinir a senha da sua conta Supreme.",
      "",
      resetUrl,
      "",
      "O link expira em 60 minutos e só funciona uma vez.",
      "Se você não solicitou a alteração, ignore esta mensagem.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717">
        <h1 style="font-size:22px">Redefina sua senha</h1>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta Supreme.</p>
        <p><a href="${safeUrl}">Criar nova senha</a></p>
        <p>O link expira em 60 minutos e só funciona uma vez.</p>
        <p>Se você não solicitou a alteração, ignore esta mensagem.</p>
      </div>
    `,
  });
}

export async function sendEmailChangeVerification({
  to,
  verificationUrl,
}: {
  to: string;
  verificationUrl: string;
}) {
  const safeUrl = escapeHtml(verificationUrl);

  await sendTransactionalEmail({
    to,
    subject: "Confirme seu novo e-mail no Supreme",
    text: [
      "Recebemos uma solicitação para usar este endereço em uma conta Supreme.",
      "",
      verificationUrl,
      "",
      "O link expira em 60 minutos e só funciona uma vez.",
      "A troca só será concluída depois da sua confirmação.",
      "Se você não solicitou esta alteração, ignore esta mensagem.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717">
        <h1 style="font-size:22px">Confirme seu novo e-mail</h1>
        <p>Recebemos uma solicitação para usar este endereço em uma conta Supreme.</p>
        <p><a href="${safeUrl}">Confirmar novo e-mail</a></p>
        <p>O link expira em 60 minutos e só funciona uma vez.</p>
        <p>A troca só será concluída depois da sua confirmação.</p>
        <p>Se você não solicitou esta alteração, ignore esta mensagem.</p>
      </div>
    `,
  });
}

export async function sendEmailChangeRequestedNotice({
  to,
  newEmail,
}: {
  to: string;
  newEmail: string;
}) {
  const safeNewEmail = escapeHtml(newEmail);

  await sendTransactionalEmail({
    to,
    subject: "Solicitação de troca de e-mail no Supreme",
    text: [
      "Uma troca de e-mail foi solicitada para sua conta Supreme.",
      `Novo endereço solicitado: ${newEmail}`,
      "",
      "A alteração ainda não foi concluída e depende da confirmação do novo endereço.",
      "Se você não reconhece esta solicitação, altere sua senha imediatamente.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717">
        <h1 style="font-size:22px">Troca de e-mail solicitada</h1>
        <p>Uma troca de e-mail foi solicitada para sua conta Supreme.</p>
        <p><strong>Novo endereço solicitado:</strong> ${safeNewEmail}</p>
        <p>A alteração ainda não foi concluída e depende da confirmação do novo endereço.</p>
        <p>Se você não reconhece esta solicitação, altere sua senha imediatamente.</p>
      </div>
    `,
  });
}

export async function sendEmailChangedNotice({ to }: { to: string }) {
  await sendTransactionalEmail({
    to,
    subject: "E-mail da conta Supreme alterado",
    text: [
      "O e-mail principal da sua conta Supreme foi alterado.",
      "Todas as sessões anteriores foram encerradas.",
      "",
      "Se você não reconhece esta alteração, proteja imediatamente suas contas de e-mail e contate o suporte.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717">
        <h1 style="font-size:22px">E-mail alterado</h1>
        <p>O e-mail principal da sua conta Supreme foi alterado.</p>
        <p>Todas as sessões anteriores foram encerradas.</p>
        <p>Se você não reconhece esta alteração, proteja imediatamente suas contas de e-mail e contate o suporte.</p>
      </div>
    `,
  });
}
