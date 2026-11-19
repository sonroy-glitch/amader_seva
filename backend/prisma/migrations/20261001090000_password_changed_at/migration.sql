-- Logins made before a password reset stop working
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
