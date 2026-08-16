import { getToken } from "next-auth/jwt";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { accountDeletionSubjectHash } from "@/lib/account-deletion-identity";
import { prisma } from "@/lib/prisma";
import { isSessionTokenCurrent } from "@/lib/session-invalidation";
import { deleteUploadThingFiles } from "@/lib/uploadthing-files";

const f = createUploadthing();

export const ourFileRouter = {
  visionImageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!token?.sub || !(await isSessionTokenCurrent(token))) {
        throw new UploadThingError("Não autenticado.");
      }

      const user = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { deletionRequest: { select: { status: true } } },
      });
      if (
        !user ||
        user.deletionRequest?.status === "PENDING_REMOTE_CLEANUP"
      ) {
        throw new UploadThingError(
          "A conta não está disponível para receber arquivos."
        );
      }

      return { userId: token.sub };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const completion = await prisma.$transaction(
        async (transaction) => {
          const lockedUser = await transaction.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "users"
            WHERE "id" = ${metadata.userId}
            FOR UPDATE
          `;
          const user =
            lockedUser.length === 1
              ? await transaction.user.findUnique({
                  where: { id: metadata.userId },
                  select: {
                    deletionRequest: {
                      select: { id: true, status: true, fileKeys: true },
                    },
                  },
                })
              : null;

          if (user && !user.deletionRequest) {
            const image = await transaction.visionImage.create({
              data: {
                imageUrl: file.ufsUrl,
                providerFileKey: file.key,
                userId: metadata.userId,
              },
            });
            return { image, cleanupRequestId: null };
          }

          const deletionRequest =
            user?.deletionRequest ??
            (await transaction.accountDeletionRequest.findUnique({
              where: {
                subjectHash: accountDeletionSubjectHash(metadata.userId),
              },
              select: { id: true, status: true, fileKeys: true },
            }));
          if (!deletionRequest) {
            return { image: null, cleanupRequestId: null };
          }

          const fileKeys = [...new Set([...deletionRequest.fileKeys, file.key])];
          await transaction.accountDeletionRequest.update({
            where: { id: deletionRequest.id },
            data: {
              status: "PENDING_REMOTE_CLEANUP",
              fileKeys,
              fileCount: fileKeys.length,
              completedAt: null,
            },
          });

          return { image: null, cleanupRequestId: deletionRequest.id };
        },
        { isolationLevel: "Serializable" }
      );

      if (!completion.image) {
        try {
          await deleteUploadThingFiles([file.key]);
        } catch (error) {
          if (completion.cleanupRequestId) {
            await prisma.accountDeletionRequest.updateMany({
              where: {
                id: completion.cleanupRequestId,
                status: "PENDING_REMOTE_CLEANUP",
              },
              data: {
                attemptCount: { increment: 1 },
                lastAttemptAt: new Date(),
              },
            });
          }
          throw error;
        }

        if (completion.cleanupRequestId) {
          await prisma.$transaction(
            async (transaction) => {
              await transaction.$queryRaw<Array<{ id: string }>>`
                SELECT "id"
                FROM "account_deletion_requests"
                WHERE "id" = ${completion.cleanupRequestId}
                FOR UPDATE
              `;
              const deletionRequest =
                await transaction.accountDeletionRequest.findUnique({
                  where: { id: completion.cleanupRequestId! },
                  select: { userId: true, fileKeys: true },
                });
              if (!deletionRequest) return;

              const fileKeys = deletionRequest.fileKeys.filter(
                (fileKey) => fileKey !== file.key
              );
              const completed =
                deletionRequest.userId === null && fileKeys.length === 0;
              await transaction.accountDeletionRequest.update({
                where: { id: completion.cleanupRequestId! },
                data: {
                  status: completed ? "COMPLETED" : "PENDING_REMOTE_CLEANUP",
                  fileKeys,
                  fileCount: fileKeys.length,
                  completedAt: completed ? new Date() : null,
                  attemptCount: { increment: 1 },
                  lastAttemptAt: new Date(),
                },
              });
            },
            { isolationLevel: "Serializable" }
          );
        }

        throw new UploadThingError(
          "O upload foi descartado porque a conta está em exclusão."
        );
      }

      const image = completion.image;

      return {
        image: {
          id: image.id,
          imageUrl: image.imageUrl,
          createdAt: image.createdAt.toISOString(),
        },
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
