import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

// NOTE: o Route Handler do App Router (src/app/api/auth/[...nextauth]/route.ts)
// só pode exportar métodos HTTP, então a configuração do NextAuth vive aqui
// e é importada tanto pelo handler quanto por getServerSession() nas outras rotas.

export const authOptions: NextAuthOptions = {
  // O @auth/prisma-adapter tipa seu parâmetro contra o PrismaClient clássico
  // de "@prisma/client". Como o projeto usa o novo gerador do Prisma 7 com
  // output customizado (src/generated/prisma), o client é estruturalmente
  // compatível (mesmos delegates: user, account, session, verificationToken),
  // mas a origem do tipo difere — por isso o cast abaixo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
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
  ],

  callbacks: {
    async jwt({ token, user }) {
      // No login, 'user' vem do authorize(); NextAuth já usa user.id como
      // token.sub por padrão, mas fixamos explicitamente aqui.
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // token.sub é o "subject" padrão do JWT — injetamos como id em
      // session.user para uso nas rotas via getServerSession().
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
