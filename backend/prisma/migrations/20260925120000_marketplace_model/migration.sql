-- CreateEnum
CREATE TYPE "Slot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('HELD', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'HELD';
COMMIT;

-- DropForeignKey
ALTER TABLE "Provider" DROP CONSTRAINT "Provider_serviceId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "agreedPrice" INTEGER NOT NULL,
ADD COLUMN     "heldUntil" TIMESTAMP(3),
ADD COLUMN     "problem" TEXT,
ADD COLUMN     "slot" "Slot" NOT NULL,
ADD COLUMN     "slotKey" TEXT,
ALTER COLUMN "date" SET DATA TYPE DATE,
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'HELD';

-- AlterTable
ALTER TABLE "Provider" DROP COLUMN "location",
DROP COLUMN "serviceId",
ADD COLUMN     "area" TEXT NOT NULL,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pincode" TEXT NOT NULL,
ADD COLUMN     "slots" "Slot"[],
ADD COLUMN     "workingDays" INTEGER[],
ALTER COLUMN "experience" SET NOT NULL,
ALTER COLUMN "experience" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "ProviderService" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "ProviderService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "providerId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderService_providerId_serviceId_key" ON "ProviderService"("providerId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_slotKey_key" ON "Booking"("slotKey");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- AddForeignKey
ALTER TABLE "ProviderService" ADD CONSTRAINT "ProviderService_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderService" ADD CONSTRAINT "ProviderService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

