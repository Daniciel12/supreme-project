-- CreateTable
CREATE TABLE "workout_completions" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workoutId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "workout_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_completions_userId_date_idx" ON "workout_completions"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "workout_completions_workoutId_date_key" ON "workout_completions"("workoutId", "date");

-- AddForeignKey
ALTER TABLE "workout_completions" ADD CONSTRAINT "workout_completions_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_completions" ADD CONSTRAINT "workout_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
