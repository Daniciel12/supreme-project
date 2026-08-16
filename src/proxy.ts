import { withAuth } from "next-auth/middleware";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { isSessionTokenCurrent } from "@/lib/session-invalidation";

const authProxy = withAuth({});

export async function proxy(...args: Parameters<typeof authProxy>) {
  const [request] = args;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const tokenIsCurrent = token
    ? await isSessionTokenCurrent(token).catch(() => false)
    : false;

  if (request.nextUrl.pathname === "/login") {
    return tokenIsCurrent
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (token && !tokenIsCurrent) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return authProxy(...args);
}

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/uploadthing|api/account/email-change/confirm|verificar-email|alterar-email|recuperar-senha|redefinir-senha|_next/static|_next/image|favicon.ico).*)",
  ],
};
