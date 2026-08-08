import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  // Alterado de 'imageUploader' para 'visionImageUploader' para bater com o frontend
  visionImageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      return { status: "ok" };
    })
    .onUploadComplete(async ({ file }) => {
      console.log("Upload concluído com sucesso:", file.url);
      return { url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
