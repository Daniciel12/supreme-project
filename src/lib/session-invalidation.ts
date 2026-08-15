import "server-only";

import type { JWT } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

function tokenIssuedAtMilliseconds(token: JWT) {
  if (
    typeof token.sessionIssuedAt === "number" &&
    Number.isFinite(token.sessionIssuedAt)
  ) {
    return token.sessionIssuedAt;
  }

  if (typeof token.iat === "number" && Number.isFinite(token.iat)) {
    return token.iat * 1000;
  }

  return null;
}

export async function isSessionTokenCurrent(token: JWT) {
  if (!token.sub) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: token.sub },
    select: { sessionsValidAfter: true },
  });

  if (!user) {
    return false;
  }

  if (!user.sessionsValidAfter) {
    return true;
  }

  const issuedAt = tokenIssuedAtMilliseconds(token);
  return issuedAt !== null && issuedAt >= user.sessionsValidAfter.getTime();
}
