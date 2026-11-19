import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { auth, allow } from "../middleware/auth.js";
import { SLOTS, checkBookable } from "../lib/slots.js";
import logger from "../lib/logger.js";

const router = express.Router();

const profileSchema = z.object({
  bio: z.string().trim().max(500).optional(),
  area: z.string().trim().min(2, "Area is required"),
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  experience: z.number().int().min(0).max(60),
  slots: z.array(z.enum(SLOTS)).min(1, "Choose at least one time slot"),
});

// The top of a price range can be at most this many times the bottom
const PRICE_SPREAD = 3;

const serviceJobsSchema = z.object({
  serviceId: z.number().int(),
  jobs: z
    .array(
      z.object({
        jobId: z.number().int(),
        minPrice: z.number().int().min(1, "Price must be more than 0").max(999999),
        maxPrice: z.number().int().min(1, "Price must be more than 0").max(999999),
      })
    )
    .min(1, "Choose at least one job you do"),
});

const availabilitySchema = z.object({
  isAvailable: z.boolean(),
});

const searchSchema = z.object({
  serviceId: z.coerce.number().int(),
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  date: z.iso.date("Invalid date"),
  slot: z.enum(SLOTS),
});

// ---------- Customer: find providers ----------

// Providers who offer this service, in this pincode, and are free on this date + slot
router.get("/search", async (req, res) => {
  try {
    const result = searchSchema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const { serviceId, pincode, date, slot } = result.data;

    const notBookable = checkBookable(date, slot);
    if (notBookable) {
      return res.status(400).json({ message: notBookable });
    }

    const now = new Date();
    const rows = await prisma.providerService.findMany({
      where: {
        serviceId,
        provider: {
          isVerified: true,
          isAvailable: true,
          user: { isBlocked: false },
          pincode,
          slots: { has: slot },
          // Has set a price for at least one job of this service
          jobs: { some: { job: { serviceId } } },
          // No booking and no unexpired hold on this slot
          bookings: {
            none: {
              date: new Date(date),
              slot,
              OR: [
                { status: { in: ["CONFIRMED", "COMPLETED"] } },
                { status: "PENDING", replyBy: { gt: now } },
                { status: "HELD", heldUntil: { gt: now } },
              ],
            },
          },
        },
      },
      include: {
        provider: {
          include: {
            user: { select: { name: true } },
            jobs: { where: { job: { serviceId } }, include: { job: { select: { isCheckup: true } } } },
          },
        },
      },
    });

    const providers = rows.map((row) => {
      const checkup = row.provider.jobs.find((j) => j.job.isCheckup);
      const work = row.provider.jobs.filter((j) => !j.job.isCheckup);
      return {
        providerId: row.provider.id,
        name: row.provider.user.name,
        area: row.provider.area,
        experience: row.provider.experience,
        // "Jobs from Rs X" (null if they only offer a check-up visit)
        fromPrice: work.length ? Math.min(...work.map((j) => j.minPrice)) : null,
        visitCharge: checkup ? checkup.minPrice : null,
      };
    });

    // Cheapest first
    providers.sort((a, b) => (a.fromPrice ?? a.visitCharge) - (b.fromPrice ?? b.visitCharge));

    return res.json({ providers });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Provider: my profile ----------

router.get("/me", auth, allow("PROVIDER"), async (req, res) => {
  try {
    const provider = await prisma.provider.findUnique({
      where: { userId: req.user.id },
      include: {
        services: { include: { service: { select: { id: true, name: true } } } },
        jobs: { select: { jobId: true, minPrice: true, maxPrice: true } },
      },
    });
    if (!provider) {
      return res.status(404).json({ message: "Please complete your provider profile" });
    }
    return res.json({ provider });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Create or update my profile
router.put("/me", auth, allow("PROVIDER"), async (req, res) => {
  try {
    const result = profileSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    // Saving again after a rejection sends the profile back for review.
    // So does an approved provider changing where they work.
    const old = await prisma.provider.findUnique({ where: { userId: req.user.id } });
    const movedArea =
      old?.isVerified &&
      (old.pincode !== result.data.pincode || old.area.toLowerCase() !== result.data.area.toLowerCase());
    const provider = await prisma.provider.upsert({
      where: { userId: req.user.id },
      create: { ...result.data, userId: req.user.id },
      update: { ...result.data, rejectReason: null, ...(movedArea && { isVerified: false }) },
    });
    logger.info("Provider profile saved", { userId: req.user.id, underReview: Boolean(movedArea) });
    return res.json({ provider, underReview: Boolean(movedArea) });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Turn taking new bookings on / off
router.patch("/me/availability", auth, allow("PROVIDER"), async (req, res) => {
  try {
    const result = availabilitySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const provider = await prisma.provider.findUnique({
      where: { userId: req.user.id },
    });
    if (!provider) {
      return res.status(404).json({ message: "Please complete your provider profile" });
    }
    const updated = await prisma.provider.update({
      where: { id: provider.id },
      data: { isAvailable: result.data.isAvailable },
    });
    logger.info("Provider availability changed", { userId: req.user.id, isAvailable: updated.isAvailable });
    return res.json({ isAvailable: updated.isAvailable });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Add a service I offer with my price for each job I do, or change them
router.put("/me/services", auth, allow("PROVIDER"), async (req, res) => {
  try {
    const result = serviceJobsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const { serviceId, jobs } = result.data;

    const provider = await prisma.provider.findUnique({
      where: { userId: req.user.id },
    });
    if (!provider) {
      return res.status(404).json({ message: "Please complete your provider profile" });
    }
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    const serviceJobs = await prisma.serviceJob.findMany({ where: { serviceId } });
    for (const job of jobs) {
      const serviceJob = serviceJobs.find((j) => j.id === job.jobId);
      if (!serviceJob) {
        return res.status(400).json({ message: "This job is not part of this service" });
      }
      if (job.maxPrice < job.minPrice) {
        return res.status(400).json({ message: "The highest price can't be less than the lowest" });
      }
      if (job.maxPrice > job.minPrice * PRICE_SPREAD) {
        return res.status(400).json({ message: "Keep the range short: the highest price can be at most 3 times the lowest" });
      }
      if (serviceJob.isCheckup && job.maxPrice !== job.minPrice) {
        return res.status(400).json({ message: "The visit charge must be one fixed price" });
      }
    }
    if (new Set(jobs.map((j) => j.jobId)).size !== jobs.length) {
      return res.status(400).json({ message: "Each job can be added only once" });
    }

    // Replace my old prices for this service with the new list
    await prisma.$transaction([
      prisma.providerService.upsert({
        where: { providerId_serviceId: { providerId: provider.id, serviceId } },
        create: { providerId: provider.id, serviceId },
        update: {},
      }),
      prisma.providerJob.deleteMany({ where: { providerId: provider.id, job: { serviceId } } }),
      prisma.providerJob.createMany({ data: jobs.map((j) => ({ ...j, providerId: provider.id })) }),
    ]);
    logger.info("Provider prices saved", { userId: req.user.id, serviceId });
    return res.json({ message: "Prices saved" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Stop offering a service
router.delete("/me/services/:serviceId", auth, allow("PROVIDER"), async (req, res) => {
  try {
    const serviceId = Number(req.params.serviceId);
    if (!Number.isInteger(serviceId)) {
      return res.status(404).json({ message: "Service not found" });
    }
    const provider = await prisma.provider.findUnique({
      where: { userId: req.user.id },
    });
    if (!provider) {
      return res.status(404).json({ message: "Please complete your provider profile" });
    }
    await prisma.$transaction([
      prisma.providerJob.deleteMany({ where: { providerId: provider.id, job: { serviceId } } }),
      prisma.providerService.deleteMany({ where: { providerId: provider.id, serviceId } }),
    ]);
    logger.info("Provider removed a service", { userId: req.user.id, serviceId });
    return res.json({ message: "Service removed" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Public: provider name, area and job prices (shown on the booking page) ----------

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ message: "Provider not found" });
    }
    const provider = await prisma.provider.findFirst({
      where: { id, isVerified: true, user: { isBlocked: false } },
      include: {
        user: { select: { name: true } },
        services: { include: { service: { select: { id: true, name: true } } } },
        jobs: { include: { job: true }, orderBy: { job: { sortOrder: "asc" } } },
      },
    });
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }
    return res.json({
      provider: {
        id: provider.id,
        name: provider.user.name,
        bio: provider.bio,
        area: provider.area,
        experience: provider.experience,
        slots: provider.slots,
        services: provider.services.map((s) => ({
          serviceId: s.service.id,
          name: s.service.name,
          jobs: provider.jobs
            .filter((j) => j.job.serviceId === s.serviceId)
            .map((j) => ({
              jobId: j.jobId,
              name: j.job.name,
              isCheckup: j.job.isCheckup,
              minPrice: j.minPrice,
              maxPrice: j.maxPrice,
            })),
        })),
      },
    });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;
