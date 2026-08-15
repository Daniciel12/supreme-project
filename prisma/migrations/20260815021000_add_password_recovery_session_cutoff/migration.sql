-- Additive session-revocation cutoff used after a password reset.
ALTER TABLE "users"
ADD COLUMN "sessionsValidAfter" TIMESTAMP(3);
