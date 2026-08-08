import { DefaultSession } from "next-auth";

// Estende o tipo padrão de Session do NextAuth para incluir o 'id' do
// usuário em session.user (necessário porque usamos CredentialsProvider
// com estratégia JWT e injetamos token.sub como id no callback session()
// em src/lib/auth.ts). O JWT já tem 'sub' tipado por padrão, então não
// precisa de augmentation aqui.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
