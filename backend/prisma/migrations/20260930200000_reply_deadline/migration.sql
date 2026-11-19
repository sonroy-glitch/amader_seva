-- A request the provider did not answer in time
ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';

-- When the provider must accept or decline by
ALTER TABLE "Booking" ADD COLUMN "replyBy" TIMESTAMP(3);

-- Requests already waiting get 24 hours from now
UPDATE "Booking" SET "replyBy" = NOW() + INTERVAL '24 hours' WHERE "status" = 'PENDING';
