import { getToken } from "next-auth/jwt";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { prisma } from "@/lib/prisma";

const f = createUploadthing();

export const ourFileRouter = {
  visionImageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!token?.sub) {
        throw new UploadThingError("Não autenticado.");
      }

      return { userId: token.sub };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const image = await prisma.visionImage.create({
        data: {
          imageUrl: file.ufsUrl,
          userId: metadata.userId,
        },
      });

      return { image };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
