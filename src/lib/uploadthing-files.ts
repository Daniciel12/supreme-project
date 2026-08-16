import "server-only";

import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function deleteUploadThingFiles(fileKeys: string[]) {
  const uniqueKeys = [...new Set(fileKeys)];
  if (uniqueKeys.length === 0) return;

  const result = await utapi.deleteFiles(uniqueKeys);
  if (!result.success) {
    throw new Error("UploadThing cleanup did not complete.");
  }
}
