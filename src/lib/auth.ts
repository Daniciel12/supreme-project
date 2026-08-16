import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { isSessionTokenCurrent } from "@/lib/session-invalidation";

interface AuthEnvironment {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

function createAuthAdapter() {
  // Prisma 7 uses a custom generated client whose runtime delegates are
  // compatible with the adapter, despite the distinct generated type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = PrismaAdapter(prisma as any);
  const linkAccount = adapter.linkAccount;

  if (!linkAccount) {
    throw new Error("The authentication adapter cannot link OAuth accounts.");
  }

  return {
    ...adapter,
    async linkAccount(account: Parameters<typeof linkAccount>[0]) {
      const targetUser = await prisma.user.findUnique({
        where: { id: account.userId },
        select: {
          password: true,
          accounts: {
            select: { id: true },
            take: 1,
          },
        },
      });

      const isInitialOAuthAccount =
        targetUser?.password === null && targetUser.accounts.length === 0;

      if (!isInitialOAuthAccount) {
        throw new Error("OAuth account linking is disabled for existing users.");
      }

      return linkAccount(account);
    },
  };
}

export function createAuthOptions(
  environment: AuthEnvironment = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  }
): NextAuthOptions {
  const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: {
            email: {
              equals: credentials.email.trim().toLowerCase(),
              mode: "insensitive",
            },
          },
        });

        if (!user?.password) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ];

  if (environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: environment.GOOGLE_CLIENT_ID,
        clientSecret: environment.GOOGLE_CLIENT_SECRET,
      })
    );
  }

  return {
    adapter: createAuthAdapter(),

    session: {
      strategy: "jwt",
    },

    pages: {
      signIn: "/login",
      error: "/login",
    },

    providers,

    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.sub = user.id;
          token.sessionIssuedAt = Date.now();
          return token;
        }

        if (!(await isSessionTokenCurrent(token))) {
          throw new Error("Session is no longer valid.");
        }

        return token;
      },
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub;
        }

        const issuedAt =
          typeof token.sessionIssuedAt === "number"
            ? token.sessionIssuedAt
            : typeof token.iat === "number"
              ? token.iat * 1000
              : null;
        if (issuedAt !== null && Number.isFinite(issuedAt)) {
          session.authenticatedAt = new Date(issuedAt).toISOString();
        }
        return session;
      },
    },
  };
}

export const authOptions = createAuthOptions();
