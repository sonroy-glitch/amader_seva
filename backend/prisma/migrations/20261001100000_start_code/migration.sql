-- Start code: the provider enters the customer's code on arrival
ALTER TABLE "Booking" ADD COLUMN "startCode" TEXT;
ALTER TABLE "Booking" ADD COLUMN "startCodeAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "codeProblemAt" TIMESTAMP(3);

-- Who cancelled and why
ALTER TABLE "Booking" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "Booking" ADD COLUMN "cancelReason" TEXT;

-- Bookings already accepted get a code now
UPDATE "Booking" SET "startCode" = LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0') WHERE "status" = 'CONFIRMED';
