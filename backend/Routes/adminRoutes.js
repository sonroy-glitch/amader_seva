import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { auth, allow } from "../middleware/auth.js";
import { notify, whenText } from "../lib/email.js";
import logger from "../lib/logger.js";

const router = express.Router();

router.use(auth, allow("ADMIN"));

// Ids are whole numbers that fit in the database, anything else is not found
router.param("id", (req, res, next, id) => {
  if (!/^\d{1,9}$/.test(id)) {
    let message = "Booking not found";
    if (req.path.startsWith("/providers")) message = "Provider not found";
    if (req.path.startsWith("/users")) message = "User not found";
    return res.status(404).json({ message });
  }
  next();
});

// Approve, or reject with a reason the provider will see
const verifySchema = z.object({
  isVerified: z.boolean(),
  rejectReason: z.string().trim().max(300).optional(),
});

const blockSchema = z.object({
  isBlocked: z.boolean(),
});

// ---------- Counts for the top of the admin page ----------

router.get("/summary", async (req, res) => {
  try {
    const [customers, providers, waiting, byStatus] = await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.provider.count(),
      prisma.provider.count({ where: { isVerified: false, rejectReason: null } }),
      prisma.booking.groupBy({ by: ["status"], _count: true, where: { status: { not: "HELD" } } }),
    ]);
    const bookings = {};
    for (const row of byStatus) bookings[row.status] = row._count;
    return res.json({ customers, providers, waiting, bookings });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Providers: waiting for approval first ----------

router.get("/providers", async (req, res) => {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: [{ isVerified: "asc" }, { createdAt: "desc" }],
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, isBlocked: true } },
        services: { include: { service: { select: { name: true } } } },
        jobs: { include: { job: { select: { serviceId: true } } } },
      },
    });
    // How often each provider dropped a job they accepted, or did not come
    const dropped = await prisma.booking.groupBy({
      by: ["providerId", "cancelledBy"],
      _count: true,
      where: { cancelledBy: { in: ["PROVIDER", "NO_SHOW"] } },
    });
    const countOf = (providerId, cancelledBy) =>
      dropped.find((row) => row.providerId === providerId && row.cancelledBy === cancelledBy)?._count || 0;
    return res.json({
      providers: providers.map((p) => ({
        id: p.id,
        userId: p.user.id,
        name: p.user.name,
        email: p.user.email,
        phone: p.user.phone,
        area: p.area,
        pincode: p.pincode,
        experience: p.experience,
        bio: p.bio,
        // Each service with the provider's lowest job price
        services: p.services.map((s) => {
          const prices = p.jobs.filter((j) => j.job.serviceId === s.serviceId).map((j) => j.minPrice);
          return { name: s.service.name, fromPrice: prices.length ? Math.min(...prices) : null };
        }),
        isVerified: p.isVerified,
        rejectReason: p.rejectReason,
        isBlocked: p.user.isBlocked,
        cancelledAfterAccepting: countOf(p.id, "PROVIDER"),
        noShows: countOf(p.id, "NO_SHOW"),
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Approve a provider (shows them in search) or reject with a reason
router.patch("/providers/:id", async (req, res) => {
  try {
    const result = verifySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const { isVerified } = result.data;
    const rejectReason = result.data.rejectReason || "";
    if (!isVerified && rejectReason.length < 3) {
      return res.status(400).json({ message: "Write why the profile is not approved" });
    }
    const id = Number(req.params.id);
    const provider = await prisma.provider.findUnique({ where: { id }, include: { user: true } });
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    await prisma.provider.update({
      where: { id },
      data: { isVerified, rejectReason: isVerified ? null : rejectReason },
    });

    if (isVerified) {
      notify(provider.user.email, provider.user.name, "Your Amader Seva profile is approved", [
        "Your provider profile is approved. Customers in your area can now find and book you.",
        "",
        "Keep your rates and time slots up to date, and turn off new bookings when you are away.",
      ]);
    } else {
      notify(provider.user.email, provider.user.name, "Your Amader Seva profile is not approved", [
        "Your provider profile is not approved yet.",
        "",
        `Reason: ${rejectReason}`,
        "",
        "Please fix this in your profile and save it. We will review it again.",
      ]);
    }

    logger.info("Admin changed provider approval", { adminId: req.user.id, providerId: provider.id, isVerified });
    return res.json({ isVerified });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Customers ----------

router.get("/customers", async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { _count: { select: { bookings: true } } },
    });
    return res.json({
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        isBlocked: c.isBlocked,
        bookings: c._count.bookings,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// A blocked person can't use the app, so their upcoming bookings (not started yet)
// are cancelled and the other person is told
async function cancelUpcomingBookings(userId) {
  await prisma.booking.deleteMany({ where: { customerId: userId, status: "HELD" } });

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      startedAt: null,
      OR: [{ customerId: userId }, { provider: { userId } }],
    },
    include: {
      service: { select: { name: true } },
      customer: { select: { name: true, email: true } },
      provider: { include: { user: { select: { name: true, email: true } } } },
    },
  });

  for (const booking of bookings) {
    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: booking.status, startedAt: null },
      data: { status: "CANCELLED", slotKey: null, cancelledBy: "ADMIN" },
    });
    if (updated.count === 0) continue;

    logger.info("Booking cancelled because an account was blocked", { bookingId: booking.id, blockedUserId: userId });
    const line = `The ${booking.service.name} booking on ${whenText(booking.date, booking.slot)} was cancelled by Amader Seva.`;
    if (booking.customerId === userId) {
      notify(booking.provider.user.email, booking.provider.user.name, `Booking cancelled: ${booking.service.name}`, [
        line,
        "",
        "This slot is free again for other customers.",
      ]);
    } else {
      notify(booking.customer.email, booking.customer.name, `Booking cancelled: ${booking.service.name}`, [
        line,
        "",
        "Please book another provider on Amader Seva.",
      ]);
    }
  }
}

// Block or unblock a customer or provider. Admins can't be blocked here.
router.patch("/users/:id", async (req, res) => {
  try {
    const result = blockSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role === "ADMIN") {
      return res.status(404).json({ message: "User not found" });
    }
    await prisma.user.update({
      where: { id },
      data: { isBlocked: result.data.isBlocked },
    });
    if (result.data.isBlocked) {
      await cancelUpcomingBookings(id);
    }
    logger.info("Admin changed account block", { adminId: req.user.id, userId: id, isBlocked: result.data.isBlocked });
    return res.json({ isBlocked: result.data.isBlocked });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Latest bookings ----------

router.get("/bookings", async (req, res) => {
  try {
    const include = {
      service: { select: { name: true } },
      job: { select: { name: true } },
      customer: { select: { name: true, phone: true } },
      provider: { include: { user: { select: { name: true, phone: true } } } },
    };
    // Open start code problems first, so they are never missed
    const problems = await prisma.booking.findMany({
      where: { status: "CONFIRMED", startedAt: null, codeProblemAt: { not: null } },
      orderBy: { codeProblemAt: "asc" },
      include,
    });
    const latest = await prisma.booking.findMany({
      where: { status: { not: "HELD" }, id: { notIn: problems.map((b) => b.id) } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include,
    });
    const bookings = [...problems, ...latest];
    return res.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        service: b.service.name,
        date: b.date,
        slot: b.slot,
        address: b.address,
        job: b.job?.name || null,
        agreedPrice: b.agreedPrice,
        maxPrice: b.maxPrice,
        status: b.status,
        customerName: b.customer.name,
        customerPhone: b.customer.phone,
        providerName: b.provider.user.name,
        providerPhone: b.provider.user.phone,
        startedAt: b.startedAt,
        codeProblemAt: b.codeProblemAt,
        cancelledBy: b.cancelledBy,
        cancelReason: b.cancelReason,
      })),
    });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Cancel a waiting or accepted booking (work not started yet), and tell both people
router.post("/bookings/:id/cancel", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        service: { select: { name: true } },
        customer: { select: { name: true, email: true } },
        provider: { include: { user: { select: { name: true, email: true } } } },
      },
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const updated = await prisma.booking.updateMany({
      where: { id, status: { in: ["PENDING", "CONFIRMED"] }, startedAt: null },
      data: { status: "CANCELLED", slotKey: null, cancelledBy: "ADMIN" },
    });
    if (updated.count === 0) {
      return res.status(400).json({ message: "This booking can no longer be cancelled" });
    }

    const lines = [
      `The ${booking.service.name} booking on ${whenText(booking.date, booking.slot)} was cancelled by Amader Seva.`,
    ];
    notify(booking.customer.email, booking.customer.name, `Booking cancelled: ${booking.service.name}`, [
      ...lines,
      "",
      "Please book another provider on Amader Seva.",
    ]);
    notify(booking.provider.user.email, booking.provider.user.name, `Booking cancelled: ${booking.service.name}`, lines);

    logger.info("Admin cancelled booking", { adminId: req.user.id, bookingId: id });
    return res.json({ message: "Booking cancelled" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Let the work start when the customer could not give the code
// (after the admin has called both people)
router.post("/bookings/:id/start", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.booking.updateMany({
      where: { id, status: "CONFIRMED", startedAt: null },
      data: { startedAt: new Date() },
    });
    if (updated.count === 0) {
      return res.status(400).json({ message: "This booking can't be started" });
    }
    logger.info("Admin let work start", { adminId: req.user.id, bookingId: id });
    return res.json({ message: "Work started" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Mark a started job completed when the provider forgot to (so the customer can pay)
router.post("/bookings/:id/complete", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { service: { select: { name: true } }, customer: { select: { name: true, email: true } } },
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const updated = await prisma.booking.updateMany({
      where: { id, status: "CONFIRMED", startedAt: { not: null } },
      data: { status: "COMPLETED" },
    });
    if (updated.count === 0) {
      return res.status(400).json({ message: "Only started jobs can be completed" });
    }

    notify(booking.customer.email, booking.customer.name, `Your ${booking.service.name} work is done`, [
      `Your ${booking.service.name} booking on ${whenText(booking.date, booking.slot)} is marked as completed.`,
      "",
      "You pay online on Amader Seva.",
    ]);

    logger.info("Admin marked booking completed", { adminId: req.user.id, bookingId: id });
    return res.json({ message: "Booking completed" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;
