-- CreateTable
CREATE TABLE "vision_images" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "vision_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vision_images_userId_createdAt_idx" ON "vision_images"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "vision_images" ADD CONSTRAINT "vision_images_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
