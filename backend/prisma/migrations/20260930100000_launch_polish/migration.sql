-- Block users from the admin page
ALTER TABLE "User" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- Why the admin rejected a provider profile
ALTER TABLE "Provider" ADD COLUMN "rejectReason" TEXT;

-- Email codes for sign up
CREATE TABLE "SignupOtp" (
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SignupOtp_pkey" PRIMARY KEY ("email")
);
