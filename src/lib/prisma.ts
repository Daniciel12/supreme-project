import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 usa um driver adapter explícito em vez de gerenciar a conexão
// internamente. O client é gerado em src/generated/prisma (ver generator
// "client" em prisma/schema.prisma).

const createAdapter = () =>
  new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const createPrismaClient = () =>
  new PrismaClient({ adapter: createAdapter() });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

// Evita múltiplas instâncias do PrismaClient em dev (hot reload do Next.js)
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
