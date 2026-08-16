import "server-only";

import bcrypt from "bcrypt";
import { accountDeletionSubjectHash } from "@/lib/account-deletion-identity";
import { prisma } from "@/lib/prisma";
import { deleteUploadThingFiles } from "@/lib/uploadthing-files";

export const ACCOUNT_DELETION_CONFIRMATION = "EXCLUIR MINHA CONTA";
export const RECENT_AUTHENTICATION_WINDOW_MS = 10 * 60 * 1000;

type DeleteAccountInput = {
  userId: string;
  email: string;
  password?: string;
  authenticatedAt?: string;
};

export type DeleteAccountResult =
  | { status: "deleted" }
  | { status: "invalid-identity" }
  | { status: "recent-authentication-required" }
  | { status: "not-found" }
  | { status: "remote-cleanup-pending" };

type DeletionInventory = {
  visionImages: Array<{ providerFileKey: string | null }>;
};

const deletionInventorySelect = {
  visionImages: {
    select: { providerFileKey: true },
  },
} as const;

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isRecentAuthentication(
  authenticatedAt: string | undefined,
  now = Date.now()
) {
  if (!authenticatedAt) return false;

  const issuedAt = Date.parse(authenticatedAt);
  if (!Number.isFinite(issuedAt)) return false;

  const age = now - issuedAt;
  return age >= -60_000 && age <= RECENT_AUTHENTICATION_WINDOW_MS;
}

export function accountDeletionFileKeys(inventory: DeletionInventory) {
  return [
    ...new Set(
      inventory.visionImages
        .map((image) => image.providerFileKey)
        .filter((fileKey): fileKey is string => Boolean(fileKey))
    ),
  ].sort();
}

async function lockUser(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string
) {
  return transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "users"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;
}

async function prepareDeletion(userId: string) {
  return prisma.$transaction(
    async (transaction) => {
      const locked = await lockUser(transaction, userId);
      if (locked.length !== 1) return null;

      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: {
          ...deletionInventorySelect,
          deletionRequest: {
            select: { id: true, fileKeys: true },
          },
        },
      });
      if (!user) return null;

      const fileKeys = [
        ...new Set([
          ...accountDeletionFileKeys(user),
          ...(user.deletionRequest?.fileKeys ?? []),
        ]),
      ].sort();
      const sessionsValidAfter = new Date();

      await transaction.user.update({
        where: { id: userId },
        data: { sessionsValidAfter },
        select: { id: true },
      });
      await transaction.session.deleteMany({ where: { userId } });

      const deletionRequest = user.deletionRequest
        ? await transaction.accountDeletionRequest.update({
            where: { id: user.deletionRequest.id },
            data: {
              status: "PENDING_REMOTE_CLEANUP",
              fileKeys,
              fileCount: fileKeys.length,
              completedAt: null,
            },
            select: { id: true },
          })
        : await transaction.accountDeletionRequest.create({
            data: {
              subjectHash: accountDeletionSubjectHash(userId),
              userId,
              fileKeys,
              fileCount: fileKeys.length,
            },
            select: { id: true },
          });

      return { requestId: deletionRequest.id, fileKeys };
    },
    { isolationLevel: "Serializable" }
  );
}

async function recordCleanupAttempt(requestId: string, userId: string) {
  await prisma.accountDeletionRequest.updateMany({
    where: {
      id: requestId,
      userId,
      status: "PENDING_REMOTE_CLEANUP",
    },
    data: {
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });
}

async function finalizeDeletion({
  requestId,
  userId,
  cleanedKeys,
}: {
  requestId: string;
  userId: string;
  cleanedKeys: Set<string>;
}) {
  return prisma.$transaction(
    async (transaction) => {
      const locked = await lockUser(transaction, userId);
      if (locked.length !== 1) {
        const completed = await transaction.accountDeletionRequest.findUnique({
          where: { id: requestId },
          select: { status: true },
        });
        return completed?.status === "COMPLETED"
          ? { deleted: true as const }
          : { deleted: false as const, fileKeys: [] };
      }

      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: {
          ...deletionInventorySelect,
          deletionRequest: { select: { fileKeys: true } },
        },
      });
      if (!user) return { deleted: false as const, fileKeys: [] };

      const currentKeys = [
        ...new Set([
          ...accountDeletionFileKeys(user),
          ...(user.deletionRequest?.fileKeys ?? []),
        ]),
      ].sort();
      const outstandingKeys = currentKeys.filter((key) => !cleanedKeys.has(key));

      if (outstandingKeys.length > 0) {
        await transaction.accountDeletionRequest.update({
          where: { id: requestId },
          data: {
            fileKeys: currentKeys,
            fileCount: currentKeys.length,
          },
        });
        return { deleted: false as const, fileKeys: outstandingKeys };
      }

      await transaction.verificationToken.deleteMany({
        where: {
          OR: [
            { identifier: { startsWith: `email-verification:${userId}:` } },
            { identifier: { startsWith: `password-recovery:${userId}:` } },
          ],
        },
      });
      await transaction.user.delete({ where: { id: userId } });
      await transaction.accountDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: "COMPLETED",
          fileKeys: [],
          fileCount: cleanedKeys.size,
          completedAt: new Date(),
        },
      });

      return { deleted: true as const };
    },
    { isolationLevel: "Serializable" }
  );
}

export async function deleteAccount(
  input: DeleteAccountInput,
  deleteFiles: (fileKeys: string[]) => Promise<void> = deleteUploadThingFiles
): Promise<DeleteAccountResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, password: true },
  });

  if (!user) return { status: "not-found" };

  if (normalizedEmail(input.email) !== normalizedEmail(user.email)) {
    return { status: "invalid-identity" };
  }

  if (user.password) {
    if (!input.password || !(await bcrypt.compare(input.password, user.password))) {
      return { status: "invalid-identity" };
    }
  } else if (!isRecentAuthentication(input.authenticatedAt)) {
    return { status: "recent-authentication-required" };
  }

  const prepared = await prepareDeletion(input.userId);
  if (!prepared) return { status: "not-found" };

  const cleanedKeys = new Set<string>();
  let pendingKeys = prepared.fileKeys;

  for (let batch = 0; batch < 3; batch += 1) {
    if (pendingKeys.length > 0) {
      try {
        await deleteFiles(pendingKeys);
        pendingKeys.forEach((key) => cleanedKeys.add(key));
        await recordCleanupAttempt(prepared.requestId, input.userId);
      } catch {
        await recordCleanupAttempt(prepared.requestId, input.userId);
        return { status: "remote-cleanup-pending" };
      }
    }

    const finalized = await finalizeDeletion({
      requestId: prepared.requestId,
      userId: input.userId,
      cleanedKeys,
    });
    if (finalized.deleted) return { status: "deleted" };

    pendingKeys = finalized.fileKeys;
    if (pendingKeys.length === 0) break;
  }

  return { status: "remote-cleanup-pending" };
}
