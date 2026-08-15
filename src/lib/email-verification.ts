import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const EMAIL_VERIFICATION_PREFIX = "email-verification";
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailDigest(email: string) {
  return digest(email.trim().toLowerCase());
}

function verificationIdentifier(userId: string, email: string) {
  return `${EMAIL_VERIFICATION_PREFIX}:${userId}:${emailDigest(email)}`;
}

function parseVerificationIdentifier(identifier: string) {
  const [prefix, userId, expectedEmailDigest, ...remainder] =
    identifier.split(":");

  if (
    prefix !== EMAIL_VERIFICATION_PREFIX ||
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

export function hashEmailVerificationToken(token: string) {
  return digest(token);
}

export async function issueEmailVerificationToken({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashEmailVerificationToken(token);
  const identifier = verificationIdentifier(userId, email);
  const expires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await prisma.$transaction(async (transaction) => {
    await transaction.verificationToken.deleteMany({ where: { identifier } });
    await transaction.verificationToken.create({
      data: { identifier, token: tokenHash, expires },
    });
  });

  return { token, tokenHash, expires };
}

export async function revokeEmailVerificationToken(tokenHash: string) {
  await prisma.verificationToken.deleteMany({ where: { token: tokenHash } });
}

export async function consumeEmailVerificationToken(token: string) {
  if (!RAW_TOKEN_PATTERN.test(token)) {
    return false;
  }

  const tokenHash = hashEmailVerificationToken(token);

  return prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.verificationToken.findUnique({
      where: { token: tokenHash },
    });

    if (!storedToken) {
      return false;
    }

    const identity = parseVerificationIdentifier(storedToken.identifier);
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
      select: { id: true, email: true },
    });

    if (
      !user ||
      !equalDigests(emailDigest(user.email), identity.expectedEmailDigest)
    ) {
      await transaction.verificationToken.deleteMany({
        where: { identifier: storedToken.identifier },
      });
      return false;
    }

    const verifiedUser = await transaction.user.updateMany({
      where: { id: user.id, email: user.email },
      data: { emailVerified: new Date() },
    });
    if (verifiedUser.count !== 1) {
      return false;
    }

    await transaction.verificationToken.deleteMany({
      where: { identifier: storedToken.identifier },
    });

    return true;
  });
}
