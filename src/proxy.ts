import { withAuth } from "next-auth/middleware";

const authProxy = withAuth({});

export function proxy(...args: Parameters<typeof authProxy>) {
  return authProxy(...args);
}

export const config = {
  matcher: [
    "/((?!api/auth|api/health|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
