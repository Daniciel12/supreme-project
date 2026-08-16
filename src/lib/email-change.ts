import "server-only";

import bcrypt from "bcrypt";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { accountEmailSchema } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";
import { isRecentAuthentication } from "@/lib/recent-authentication";

const EMAIL_CHANGE_PREFIX = "email-change";
const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;
const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type RequestEmailChangeInput = {
  userId: string;
  newEmail: string;
  password?: string;
  authenticatedAt?: string;
};

export type RequestEmailChangeResult =
  | {
      status: "issued";
      token: string;
      tokenHash: string;
      currentEmail: string;
      newEmail: string;
      expires: Date;
    }
  | { status: "invalid-identity" }
  | { status: "recent-authentication-required" }
  | { status: "same-email" }
  | { status: "conflict" }
  | { status: "not-found" }
  | { status: "unavailable" };

export type ConfirmEmailChangeResult =
  | { status: "changed"; previousEmail: string; newEmail: string }
  | { status: "invalid" }
  | { status: "conflict" };

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function emailDigest(email: string) {
  return digest(email.trim().toLowerCase());
}

function equalDigests(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function requestPrefix(userId: string) {
  return `${EMAIL_CHANGE_PREFIX}:${userId}:`;
}

function emailChangeIdentifier(
  userId: string,
  currentEmail: string,
  newEmail: string
) {
  return [
    EMAIL_CHANGE_PREFIX,
    userId,
    emailDigest(currentEmail),
    Buffer.from(newEmail, "utf8").toString("base64url"),
  ].join(":");
}

function parseEmailChangeIdentifier(identifier: string) {
  const [prefix, userId, expectedCurrentEmailDigest, encodedNewEmail, ...rest] =
    identifier.split(":");

  if (
    prefix !== EMAIL_CHANGE_PREFIX ||
    !userId ||
    !/^[a-f0-9]{64}$/.test(expectedCurrentEmailDigest ?? "") ||
    !encodedNewEmail ||
    !/^[A-Za-z0-9_-]+$/.test(encodedNewEmail) ||
    rest.length > 0
  ) {
    return null;
  }

  try {
    const decodedEmail = Buffer.from(encodedNewEmail, "base64url").toString(
      "utf8"
    );
    const parsedEmail = accountEmailSchema.safeParse(decodedEmail);
    if (!parsedEmail.success || parsedEmail.data !== decodedEmail) {
      return null;
    }

    return {
      userId,
      expectedCurrentEmailDigest,
      newEmail: parsedEmail.data,
    };
  } catch {
    return null;
  }
}

export function hashEmailChangeToken(token: string) {
  return digest(token);
}

async function issueEmailChangeToken({
  userId,
  currentEmail,
  newEmail,
}: {
  userId: string;
  currentEmail: string;
  newEmail: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashEmailChangeToken(token);
  const identifier = emailChangeIdentifier(userId, currentEmail, newEmail);
  const expires = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);

  await prisma.$transaction(async (transaction) => {
    await transaction.verificationToken.deleteMany({
      where: { identifier: { startsWith: requestPrefix(userId) } },
    });
    await transaction.verificationToken.create({
      data: { identifier, token: tokenHash, expires },
    });
  });

  return { token, tokenHash, expires };
}

export async function revokeEmailChangeToken(tokenHash: string) {
  await prisma.verificationToken.deleteMany({ where: { token: tokenHash } });
}

export async function requestEmailChange(
  input: RequestEmailChangeInput
): Promise<RequestEmailChangeResult> {
  const parsedEmail = accountEmailSchema.safeParse(input.newEmail);
  if (!parsedEmail.success) return { status: "conflict" };

  const newEmail = parsedEmail.data;
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      email: true,
      password: true,
      deletionRequest: { select: { status: true } },
    },
  });

  if (!user) return { status: "not-found" };
  if (user.deletionRequest?.status === "PENDING_REMOTE_CLEANUP") {
    return { status: "unavailable" };
  }
  if (user.email.trim().toLowerCase() === newEmail) {
    return { status: "same-email" };
  }

  if (user.password) {
    if (!input.password || !(await bcrypt.compare(input.password, user.password))) {
      return { status: "invalid-identity" };
    }
  } else if (!isRecentAuthentication(input.authenticatedAt)) {
    return { status: "recent-authentication-required" };
  }

  const collision = await prisma.user.findFirst({
    where: {
      id: { not: input.userId },
      email: { equals: newEmail, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (collision) return { status: "conflict" };

  const issued = await issueEmailChangeToken({
    userId: input.userId,
    currentEmail: user.email,
    newEmail,
  });

  return {
    status: "issued",
    ...issued,
    currentEmail: user.email,
    newEmail,
  };
}

export async function confirmEmailChange(
  token: string
): Promise<ConfirmEmailChangeResult> {
  if (!RAW_TOKEN_PATTERN.test(token)) return { status: "invalid" };

  const tokenHash = hashEmailChangeToken(token);

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const storedToken = await transaction.verificationToken.findUnique({
          where: { token: tokenHash },
        });
        if (!storedToken) return { status: "invalid" as const };

        const identity = parseEmailChangeIdentifier(storedToken.identifier);
        if (!identity || storedToken.expires.getTime() <= Date.now()) {
          await transaction.verificationToken.deleteMany({
            where: { token: tokenHash },
          });
          return { status: "invalid" as const };
        }

        const claimedToken = await transaction.verificationToken.deleteMany({
          where: { token: tokenHash },
        });
        if (claimedToken.count !== 1) {
          return { status: "invalid" as const };
        }

        const lockedUser = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "users"
          WHERE "id" = ${identity.userId}
          FOR UPDATE
        `;
        if (lockedUser.length !== 1) {
          return { status: "invalid" as const };
        }

        const user = await transaction.user.findUnique({
          where: { id: identity.userId },
          select: {
            email: true,
            deletionRequest: { select: { status: true } },
          },
        });
        if (
          !user ||
          user.deletionRequest?.status === "PENDING_REMOTE_CLEANUP" ||
          !equalDigests(
            emailDigest(user.email),
            identity.expectedCurrentEmailDigest
          )
        ) {
          return { status: "invalid" as const };
        }

        const collision = await transaction.user.findFirst({
          where: {
            id: { not: identity.userId },
            email: { equals: identity.newEmail, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (collision) return { status: "conflict" as const };

        const sessionsValidAfter = new Date();
        const updated = await transaction.user.updateMany({
          where: { id: identity.userId, email: user.email },
          data: {
            email: identity.newEmail,
            emailVerified: sessionsValidAfter,
            sessionsValidAfter,
          },
        });
        if (updated.count !== 1) return { status: "invalid" as const };

        await transaction.session.deleteMany({
          where: { userId: identity.userId },
        });
        await transaction.verificationToken.deleteMany({
          where: {
            OR: [
              {
                identifier: {
                  startsWith: `email-verification:${identity.userId}:`,
                },
              },
              {
                identifier: {
                  startsWith: `password-recovery:${identity.userId}:`,
                },
              },
              {
                identifier: { startsWith: requestPrefix(identity.userId) },
              },
            ],
          },
        });

        return {
          status: "changed" as const,
          previousEmail: user.email,
          newEmail: identity.newEmail,
        };
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") return { status: "conflict" };
    throw error;
  }
}
