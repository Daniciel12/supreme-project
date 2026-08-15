import { withAuth } from "next-auth/middleware";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

const authProxy = withAuth({});

export async function proxy(...args: Parameters<typeof authProxy>) {
  const [request] = args;

  if (request.nextUrl.pathname === "/login") {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    return token
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  return authProxy(...args);
}

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/uploadthing|verificar-email|_next/static|_next/image|favicon.ico).*)",
  ],
};
