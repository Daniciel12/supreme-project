-- CreateEnum
CREATE TYPE "AccountDeletionStatus" AS ENUM ('PENDING_REMOTE_CLEANUP', 'COMPLETED');

-- AlterTable
ALTER TABLE "vision_images"
ADD COLUMN "providerFileKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "vision_images_providerFileKey_key"
ON "vision_images"("providerFileKey");

-- CreateTable
CREATE TABLE "account_deletion_requests" (
    "id" TEXT NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "userId" TEXT,
    "status" "AccountDeletionStatus" NOT NULL DEFAULT 'PENDING_REMOTE_CLEANUP',
    "fileKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_deletion_requests_subjectHash_key"
ON "account_deletion_requests"("subjectHash");

-- CreateIndex
CREATE UNIQUE INDEX "account_deletion_requests_userId_key"
ON "account_deletion_requests"("userId");

-- CreateIndex
CREATE INDEX "account_deletion_requests_status_requestedAt_idx"
ON "account_deletion_requests"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "account_deletion_requests"
ADD CONSTRAINT "account_deletion_requests_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
