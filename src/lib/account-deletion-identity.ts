import "server-only";

import { createHash } from "node:crypto";

export function accountDeletionSubjectHash(userId: string) {
  return createHash("sha256").update(userId, "utf8").digest("hex");
}
