-- AlterTable
ALTER TABLE "users"
ADD COLUMN "emailVerified" TIMESTAMP(3),
ADD COLUMN "image" TEXT,
ALTER COLUMN "password" DROP NOT NULL;
