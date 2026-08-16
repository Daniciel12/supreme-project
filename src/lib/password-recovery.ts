import "server-only";

import bcrypt from "bcrypt";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const PASSWORD_RECOVERY_PREFIX = "password-recovery";
const PASSWORD_RECOVERY_TTL_MS = 60 * 60 * 1000;
const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SALT_ROUNDS = 10;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailDigest(email: string) {
  return digest(email.trim().toLowerCase());
}

function passwordRecoveryIdentifier(userId: string, email: string) {
  return `${PASSWORD_RECOVERY_PREFIX}:${userId}:${emailDigest(email)}`;
}

function parsePasswordRecoveryIdentifier(identifier: string) {
  const [prefix, userId, expectedEmailDigest, ...remainder] =
    identifier.split(":");

  if (
    prefix !== PASSWORD_RECOVERY_PREFIX ||
    !userId ||
    !/^[a-f0-9]{64}$/.test(expectedEmailDigest ?? "") ||
    remainder.length > 0
  ) {
    return null;
  }

  return { userId, expectedEmailDigest };
}

function equalDigests(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function passwordRecoveryRateLimitKey(email: string) {
  return digest(email.trim().toLowerCase());
}

export function hashPasswordRecoveryToken(token: string) {
  return digest(token);
}

export async function issuePasswordRecoveryToken({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashPasswordRecoveryToken(token);
  const identifier = passwordRecoveryIdentifier(userId, email);
  const expires = new Date(Date.now() + PASSWORD_RECOVERY_TTL_MS);

  await prisma.$transaction(async (transaction) => {
    await transaction.verificationToken.deleteMany({ where: { identifier } });
    await transaction.verificationToken.create({
      data: { identifier, token: tokenHash, expires },
    });
  });

  return { token, tokenHash, expires };
}

export async function revokePasswordRecoveryToken(tokenHash: string) {
  await prisma.verificationToken.deleteMany({ where: { token: tokenHash } });
}

export async function resetPasswordWithToken({
  token,
  password,
}: {
  token: string;
  password: string;
}) {
  if (!RAW_TOKEN_PATTERN.test(token)) {
    return false;
  }

  const tokenHash = hashPasswordRecoveryToken(token);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.verificationToken.findUnique({
      where: { token: tokenHash },
    });

    if (!storedToken) {
      return false;
    }

    const identity = parsePasswordRecoveryIdentifier(storedToken.identifier);
    if (!identity || storedToken.expires.getTime() <= Date.now()) {
      await transaction.verificationToken.deleteMany({
        where: { token: tokenHash },
      });
      return false;
    }

    const claimedToken = await transaction.verificationToken.deleteMany({
      where: { token: tokenHash },
    });
    if (claimedToken.count !== 1) {
      return false;
    }

    const user = await transaction.user.findUnique({
      where: { id: identity.userId },
      select: { id: true, email: true, password: true },
    });

    if (
      !user?.password ||
      !equalDigests(emailDigest(user.email), identity.expectedEmailDigest)
    ) {
      await transaction.verificationToken.deleteMany({
        where: { identifier: storedToken.identifier },
      });
      return false;
    }

    const sessionsValidAfter = new Date();
    const updatedUser = await transaction.user.updateMany({
      where: { id: user.id, email: user.email, password: { not: null } },
      data: { password: passwordHash, sessionsValidAfter },
    });
    if (updatedUser.count !== 1) {
      return false;
    }

    await transaction.session.deleteMany({ where: { userId: user.id } });
    await transaction.verificationToken.deleteMany({
      where: {
        OR: [
          { identifier: storedToken.identifier },
          {
            identifier: {
              startsWith: `email-change:${user.id}:`,
            },
          },
        ],
      },
    });

    return true;
  });
}
