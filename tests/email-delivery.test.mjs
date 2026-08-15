import assert from "node:assert/strict";
import { mock, test } from "node:test";

const createTransport = mock.fn();
const sendMail = mock.fn(async () => ({ messageId: "test-message" }));
createTransport.mock.mockImplementation(() => ({ sendMail }));

mock.module("server-only", { exports: { default: {} } });
mock.module("secure-nodemailer", {
  exports: { default: { createTransport } },
});

const {
  EmailConfigurationError,
  readEmailTransportConfiguration,
  sendEmailVerification,
} = await import("../src/lib/email.ts");

const validEnvironment = {
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_USER: "supreme-user",
  SMTP_PASSWORD: "test-only-password",
  EMAIL_FROM: "Supreme <no-reply@example.test>",
};

test("SMTP configuration is strict and never guesses missing secrets", () => {
  assert.throws(
    () => readEmailTransportConfiguration({}),
    EmailConfigurationError
  );
  assert.throws(
    () =>
      readEmailTransportConfiguration({
        ...validEnvironment,
        SMTP_PORT: "not-a-port",
      }),
    /SMTP_PORT/
  );
  assert.throws(
    () =>
      readEmailTransportConfiguration({
        ...validEnvironment,
        SMTP_SECURE: "yes",
      }),
    /SMTP_SECURE/
  );
  assert.throws(
    () =>
      readEmailTransportConfiguration({
        ...validEnvironment,
        EMAIL_FROM: "Supreme\r\nBcc: attacker@example.test",
      }),
    /EMAIL_FROM/
  );
});

test("SMTP delivery requires STARTTLS and disables file and URL access", async () => {
  const previousEnvironment = Object.fromEntries(
    Object.keys(validEnvironment).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, validEnvironment);

  try {
    await sendEmailVerification({
      to: "owner@example.test",
      verificationUrl:
        "https://supreme.example/verificar-email?token=test&next=<unsafe>",
    });
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  assert.equal(createTransport.mock.callCount(), 1);
  const transport = createTransport.mock.calls[0].arguments[0];
  assert.equal(transport.secure, false);
  assert.equal(transport.requireTLS, true);
  assert.equal(transport.disableFileAccess, true);
  assert.equal(transport.disableUrlAccess, true);
  assert.equal(transport.tls.minVersion, "TLSv1.2");
  assert.equal(transport.auth.pass, "test-only-password");

  const message = sendMail.mock.calls[0].arguments[0];
  assert.equal(message.to, "owner@example.test");
  assert.match(message.text, /token=test&next=<unsafe>/);
  assert.match(message.html, /token=test&amp;next=&lt;unsafe&gt;/);
  assert.doesNotMatch(message.html, /token=test&next=<unsafe>/);
});
