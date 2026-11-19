-- Jobs customers can choose for each service (the list comes from prisma/seed.js)
CREATE TABLE "ServiceJob" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isCheckup" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceJob_serviceId_name_key" ON "ServiceJob"("serviceId", "name");
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Each provider's price for a job: fixed (min = max) or a short range
CREATE TABLE "ProviderJob" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "minPrice" INTEGER NOT NULL,
    "maxPrice" INTEGER NOT NULL,

    CONSTRAINT "ProviderJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderJob_providerId_jobId_key" ON "ProviderJob"("providerId", "jobId");
ALTER TABLE "ProviderJob" ADD CONSTRAINT "ProviderJob_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderJob" ADD CONSTRAINT "ProviderJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ServiceJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The booking remembers the chosen job and its price
ALTER TABLE "Booking" ADD COLUMN "jobId" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "maxPrice" INTEGER;
ALTER TABLE "Booking" ALTER COLUMN "agreedPrice" DROP NOT NULL;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ServiceJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The old single rate is moved to the jobs, then dropped in the next migration
ALTER TABLE "ProviderService" ALTER COLUMN "price" DROP NOT NULL;
