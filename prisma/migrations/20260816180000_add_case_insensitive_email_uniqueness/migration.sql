-- The application normalizes new addresses to lowercase. This functional
-- index also protects legacy mixed-case rows and concurrent writes.
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (LOWER("email"));
