import express from "express";
import crypto from "node:crypto";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { auth, allow } from "../middleware/auth.js";
import {
  SLOTS,
  HOLD_MINUTES,
  checkBookable,
  makeSlotKey,
  nowInIndia,
  replyDeadline,
  slotHasStarted,
  slotHasEnded,
} from "../lib/slots.js";
import { notify, whenText, timeText, priceText } from "../lib/email.js";
import { expireRequests } from "../lib/requests.js";
import logger from "../lib/logger.js";

const router = express.Router();

router.use(auth);

// /bookings/abc/... is not a real booking
router.param("id", (req, res, next, id) => {
  if (!/^\d{1,9}$/.test(id)) {
    return res.status(404).json({ message: "Booking not found" });
  }
  next();
});

const holdSchema = z.object({
  providerId: z.number().int(),
  serviceId: z.number().int(),
  date: z.iso.date("Invalid date"),
  slot: z.enum(SLOTS),
});

const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

const startSchema = z.object({
  code: z.string().regex(/^\d{4}$/, "Enter the 4-digit code"),
});

// Wrong start codes allowed before the provider has to ask us for help
const MAX_CODE_ATTEMPTS = 5;

// Requests one customer can have waiting for a reply at the same time,
// so one account can't take up many providers' slots
const MAX_WAITING_REQUESTS = 3;
const TOO_MANY_REQUESTS = "You already have 3 requests waiting for a reply. Wait for a reply or cancel one first";

function waitingRequests(customerId) {
  return prisma.booking.count({ where: { customerId, status: "PENDING" } });
}

const rescheduleSchema = z.object({
  date: z.iso.date("Invalid date"),
  slot: z.enum(SLOTS),
});

const confirmSchema = z.object({
  house: z.string().trim().min(1, "Enter your house or flat number").max(100),
  area: z.string().trim().min(3, "Enter your street and area").max(150),
  landmark: z.string().trim().max(100).default(""),
  city: z.string().trim().min(2, "Enter your city or town").max(60),
  pincode: z.string().regex(/^\d{6}$/, "Enter a 6-digit pincode"),
  jobId: z.number({ error: "Choose what needs doing" }).int(),
  problem: z.string().trim().max(500).optional(),
});

// One address text for the booking, one part per line, so the provider can read it easily
function addressText(a) {
  return [a.house, a.area, a.landmark && `Landmark: ${a.landmark}`, `${a.city} - ${a.pincode}`].filter(Boolean).join("\n");
}

// Keep the address for next time, unless the customer already has the same one
async function saveAddress(userId, a) {
  const same = await prisma.address.findFirst({
    where: {
      userId,
      house: { equals: a.house, mode: "insensitive" },
      area: { equals: a.area, mode: "insensitive" },
      landmark: { equals: a.landmark, mode: "insensitive" },
      city: { equals: a.city, mode: "insensitive" },
      pincode: a.pincode,
    },
  });
  if (!same) {
    await prisma.address.create({
      data: { userId, house: a.house, area: a.area, landmark: a.landmark, city: a.city, pincode: a.pincode },
    });
  }
}

// "Job: Fan install or repair" and "Price: Rs 300 - 600" lines for emails
// (older bookings made before job prices have no job)
function jobLines(booking) {
  const lines = [`Price: ${priceText(booking.agreedPrice, booking.maxPrice)}`];
  if (booking.job) lines.unshift(`Job: ${booking.job.name}`);
  if (booking.maxPrice > booking.agreedPrice) lines.push("The final price depends on the actual work.");
  return lines;
}

// Email every admin (for problems they need to sort out)
async function notifyAdmins(subject, lines) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { name: true, email: true } });
  for (const admin of admins) notify(admin.email, admin.name, subject, lines);
}

function dateText(booking) {
  return booking.date.toISOString().slice(0, 10);
}

// ---------- Customer: hold a slot (final booking page opened) ----------

router.post("/hold", allow("CUSTOMER"), async (req, res) => {
  try {
    const result = holdSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const { providerId, serviceId, date, slot } = result.data;

    const notBookable = checkBookable(date, slot);
    if (notBookable) {
      return res.status(400).json({ message: notBookable });
    }

    const providerService = await prisma.providerService.findUnique({
      where: { providerId_serviceId: { providerId, serviceId } },
      include: { provider: { include: { user: { select: { isBlocked: true } } } } },
    });
    if (!providerService) {
      return res.status(404).json({ message: "This provider does not offer this service" });
    }
    const provider = providerService.provider;
    if (!provider.isVerified || !provider.isAvailable || provider.user.isBlocked) {
      return res.status(400).json({ message: "This provider is not taking bookings right now" });
    }
    if (!provider.slots.includes(slot)) {
      return res.status(400).json({ message: "This provider does not work at this time" });
    }

    // Requests the provider did not answer in time should not block this slot
    await expireRequests();

    if ((await waitingRequests(req.user.id)) >= MAX_WAITING_REQUESTS) {
      return res.status(400).json({ message: TOO_MANY_REQUESTS });
    }

    // Clear old holds: expired ones (anyone's) and this customer's previous hold
    await prisma.booking.deleteMany({
      where: {
        status: "HELD",
        OR: [{ heldUntil: { lt: new Date() } }, { customerId: req.user.id }],
      },
    });

    // If someone else holds or booked this slot, the unique slotKey makes this fail
    const booking = await prisma.booking.create({
      data: {
        customerId: req.user.id,
        providerId,
        serviceId,
        date: new Date(date),
        slot,
        status: "HELD",
        heldUntil: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
        slotKey: makeSlotKey(providerId, date, slot),
      },
    });

    logger.info("Slot held", { bookingId: booking.id, customerId: req.user.id });
    return res.status(201).json({ booking });
  } catch (error) {
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ message: "This slot was just booked. Please choose another provider or slot" });
    }
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Customer: send the booking request for the held slot ----------

router.post("/:id/confirm", allow("CUSTOMER"), async (req, res) => {
  try {
    const result = confirmSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const id = Number(req.params.id);

    const held = await prisma.booking.findFirst({ where: { id, customerId: req.user.id, status: "HELD" } });
    if (!held) {
      return res.status(400).json({ message: "Your hold has expired. Please choose a slot again" });
    }
    if ((await waitingRequests(req.user.id)) >= MAX_WAITING_REQUESTS) {
      return res.status(400).json({ message: TOO_MANY_REQUESTS });
    }

    // The provider's price for the chosen job, kept on the booking
    const providerJob = await prisma.providerJob.findFirst({
      where: { providerId: held.providerId, jobId: result.data.jobId, job: { serviceId: held.serviceId } },
    });
    if (!providerJob) {
      return res.status(400).json({ message: "Choose what needs doing" });
    }

    // Only works if it is still this customer's hold and not expired.
    // The slot stays taken while the provider decides, until replyBy.
    const updated = await prisma.booking.updateMany({
      where: {
        id,
        customerId: req.user.id,
        status: "HELD",
        heldUntil: { gt: new Date() },
      },
      data: {
        status: "PENDING",
        heldUntil: null,
        replyBy: replyDeadline(held.date, held.slot),
        address: addressText(result.data),
        problem: result.data.problem,
        jobId: providerJob.jobId,
        agreedPrice: providerJob.minPrice,
        maxPrice: providerJob.maxPrice,
      },
    });
    if (updated.count === 0) {
      return res.status(400).json({ message: "Your hold has expired. Please choose a slot again" });
    }
    logger.info("Booking request sent", { bookingId: id, customerId: req.user.id, providerId: held.providerId });
    await saveAddress(req.user.id, result.data);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        service: { select: { name: true } },
        job: { select: { name: true, isCheckup: true } },
        customer: { select: { name: true } },
        provider: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    notify(booking.provider.user.email, booking.provider.user.name, `New job request: ${booking.service.name}`, [
      `${booking.customer.name} wants to book you for ${booking.service.name}.`,
      "",
      `When: ${whenText(booking.date, booking.slot)}`,
      `Job: ${booking.job.name}`,
      `Price: ${priceText(booking.agreedPrice, booking.maxPrice)}`,
      "",
      "Address:",
      booking.address,
      "",
      ...(booking.problem ? [`Work needed: ${booking.problem}`] : []),
      "",
      `Please accept or decline on Amader Seva by ${timeText(booking.replyBy)}. If you do not reply by then, the request closes on its own.`,
      "",
      "The customer's phone number is shared once you accept.",
    ]);

    return res.json({
      booking: {
        id: booking.id,
        service: booking.service.name,
        date: booking.date,
        slot: booking.slot,
        address: booking.address,
        problem: booking.problem,
        job: booking.job.name,
        isCheckup: booking.job.isCheckup,
        agreedPrice: booking.agreedPrice,
        maxPrice: booking.maxPrice,
        status: booking.status,
        replyBy: booking.replyBy,
        providerName: booking.provider.user.name,
      },
    });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Customer: leave the booking page (release the hold) ----------

router.delete("/:id/hold", allow("CUSTOMER"), async (req, res) => {
  try {
    await prisma.booking.deleteMany({
      where: { id: Number(req.params.id), customerId: req.user.id, status: "HELD" },
    });
    return res.json({ message: "Slot released" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Booking with both people's name and email, for the emails below
const withPeople = {
  service: { select: { name: true } },
  job: { select: { name: true } },
  customer: { select: { name: true, email: true } },
  provider: { include: { user: { select: { name: true, email: true, phone: true, isBlocked: true } } } },
};

// ---------- Provider: accept a booking request ----------

router.post("/:id/accept", allow("PROVIDER"), async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: Number(req.params.id), provider: { userId: req.user.id } },
      include: withPeople,
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.date.toISOString().slice(0, 10) < nowInIndia().today) {
      return res.status(400).json({ message: "This booking date has already passed" });
    }

    if (booking.status === "PENDING" && booking.replyBy < new Date()) {
      return res.status(400).json({ message: "The time to reply has passed, so this request is closed" });
    }

    // The customer gives this code to the provider on arrival
    const startCode = String(crypto.randomInt(0, 10000)).padStart(4, "0");
    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: "PENDING", replyBy: { gt: new Date() } },
      data: { status: "CONFIRMED", startCode, startCodeAttempts: 0, codeProblemAt: null },
    });
    if (updated.count === 0) {
      return res.status(400).json({ message: "Only new requests can be accepted" });
    }

    const provider = booking.provider.user;
    notify(booking.customer.email, booking.customer.name, `${provider.name} accepted your booking`, [
      `Good news! ${provider.name} accepted your ${booking.service.name} booking.`,
      "",
      `When: ${whenText(booking.date, booking.slot)}`,
      `Phone: ${provider.phone}`,
      ...jobLines(booking),
      "You pay online on Amader Seva after the work.",
      "",
      `Your start code: ${startCode}`,
      `Give this code to ${provider.name} only when they reach you. They need it to start the work. You can also see it in My bookings.`,
    ]);

    logger.info("Booking accepted", { bookingId: booking.id, providerId: booking.providerId });
    return res.json({ message: "Booking accepted" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Customer or provider: cancel (or decline) a booking ----------

router.post("/:id/cancel", async (req, res) => {
  try {
    const result = cancelSchema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const reason = result.data.reason || "";

    const booking = await prisma.booking.findUnique({
      where: { id: Number(req.params.id) },
      include: withPeople,
    });
    const byCustomer = booking && booking.customerId === req.user.id;
    const byProvider = booking && booking.provider.userId === req.user.id;
    if (!byCustomer && !byProvider) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.startedAt) {
      return res.status(400).json({ message: "The work has started, so this booking can't be cancelled" });
    }
    // Once the work time has come, nobody can cancel here. The provider enters the code
    // or reports a problem, the customer reports a no-show, and we sort out the rest.
    if (byCustomer && slotHasStarted(dateText(booking), booking.slot)) {
      return res.status(400).json({ message: "The work time has started, so this booking can't be changed now" });
    }
    if (byProvider && slotHasStarted(dateText(booking), booking.slot)) {
      return res.status(400).json({ message: "The work time has started. If you can't do this job, contact us" });
    }
    // A provider dropping a job they accepted must tell the customer why
    if (byProvider && booking.status === "CONFIRMED" && reason.length < 5) {
      return res.status(400).json({ message: "Please tell the customer why you can't come" });
    }

    if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
      return res.status(400).json({ message: "This booking can no longer be cancelled" });
    }
    let cancelledBy = "CUSTOMER";
    if (byProvider) cancelledBy = booking.status === "PENDING" ? "DECLINED" : "PROVIDER";

    // slotKey = null frees the slot for other customers.
    // Status must still be what we checked above, and work not started.
    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: booking.status, startedAt: null },
      data: { status: "CANCELLED", slotKey: null, cancelledBy, cancelReason: reason || null },
    });
    if (updated.count === 0) {
      return res.status(400).json({ message: "This booking can no longer be cancelled" });
    }

    logger.info("Booking cancelled", { bookingId: booking.id, cancelledBy, userId: req.user.id });
    // Tell the other person
    const when = whenText(booking.date, booking.slot);
    if (byProvider) {
      const provider = booking.provider.user;
      notify(booking.customer.email, booking.customer.name, `Your ${booking.service.name} booking was cancelled`, [
        `${provider.name} cannot take your ${booking.service.name} booking on ${when}.`,
        ...(reason ? [`Reason: ${reason}`] : []),
        "",
        "Please book another provider on Amader Seva.",
      ]);
    } else {
      notify(booking.provider.user.email, booking.provider.user.name, `Booking cancelled: ${booking.service.name}`, [
        `${booking.customer.name} cancelled the ${booking.service.name} booking on ${when}.`,
        "",
        "This slot is free again for other customers.",
      ]);
    }

    return res.json({ message: "Booking cancelled" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Customer: move a booking to another day or time ----------

router.post("/:id/reschedule", allow("CUSTOMER"), async (req, res) => {
  try {
    const result = rescheduleSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const { date, slot } = result.data;

    const booking = await prisma.booking.findFirst({
      where: { id: Number(req.params.id), customerId: req.user.id },
      include: withPeople,
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.startedAt || slotHasStarted(dateText(booking), booking.slot)) {
      return res.status(400).json({ message: "The work time has started, so this booking can't be changed now" });
    }
    if (dateText(booking) === date && booking.slot === slot) {
      return res.status(400).json({ message: "Choose a different day or time" });
    }
    const provider = booking.provider;
    if (!provider.isVerified || !provider.isAvailable || provider.user.isBlocked) {
      return res.status(400).json({ message: "This provider is not taking bookings right now" });
    }
    const notBookable = checkBookable(date, slot);
    if (notBookable) {
      return res.status(400).json({ message: notBookable });
    }
    if (!booking.provider.slots.includes(slot)) {
      return res.status(400).json({ message: "This provider does not work at this time" });
    }

    // Late requests and expired holds should not block the new time
    await expireRequests();

    // A confirmed booking goes back to waiting for a reply, so it counts as a new request
    if (booking.status === "CONFIRMED" && (await waitingRequests(req.user.id)) >= MAX_WAITING_REQUESTS) {
      return res.status(400).json({ message: TOO_MANY_REQUESTS });
    }
    await prisma.booking.deleteMany({
      where: { status: "HELD", heldUntil: { lt: new Date() } },
    });

    // The provider has to accept the new time again.
    // If the provider is busy then, the unique slotKey makes this fail.
    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: { in: ["PENDING", "CONFIRMED"] } },
      data: {
        date: new Date(date),
        slot,
        slotKey: makeSlotKey(booking.providerId, date, slot),
        status: "PENDING",
        replyBy: replyDeadline(date, slot),
      },
    });
    if (updated.count === 0) {
      return res.status(400).json({ message: "This booking can no longer be changed" });
    }

    notify(booking.provider.user.email, booking.provider.user.name, `Booking moved: ${booking.service.name}`, [
      `${booking.customer.name} moved the ${booking.service.name} booking.`,
      "",
      `Old time: ${whenText(booking.date, booking.slot)}`,
      `New time: ${whenText(new Date(date), slot)}`,
      "",
      `Please accept or decline the new time on Amader Seva by ${timeText(replyDeadline(date, slot))}.`,
    ]);

    logger.info("Booking moved", { bookingId: booking.id, date, slot });
    return res.json({ message: "Booking moved" });
  } catch (error) {
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ message: "The provider is not free at this time. Please choose another" });
    }
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Provider: enter the customer's code to start the work ----------

router.post("/:id/start", allow("PROVIDER"), async (req, res) => {
  try {
    const result = startSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }

    const booking = await prisma.booking.findFirst({
      where: { id: Number(req.params.id), provider: { userId: req.user.id } },
      include: withPeople,
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.status !== "CONFIRMED" || booking.startedAt) {
      return res.status(400).json({ message: "This booking can't be started" });
    }
    if (dateText(booking) > nowInIndia().today) {
      return res.status(400).json({ message: "You can start the work on the booking date" });
    }
    if (booking.startCodeAttempts >= MAX_CODE_ATTEMPTS) {
      logger.warn("Too many wrong start codes", { bookingId: booking.id });
      return res
        .status(400)
        .json({ message: "Too many wrong codes. Ask us for help using the link below" });
    }

    // Count the try before checking the code, and only while tries are left.
    // Doing it in one step means many tries sent at once can't get past the limit.
    const counted = await prisma.booking.updateMany({
      where: { id: booking.id, status: "CONFIRMED", startedAt: null, startCodeAttempts: { lt: MAX_CODE_ATTEMPTS } },
      data: { startCodeAttempts: { increment: 1 } },
    });
    if (counted.count === 0) {
      logger.warn("Too many wrong start codes", { bookingId: booking.id });
      return res
        .status(400)
        .json({ message: "Too many wrong codes. Ask us for help using the link below" });
    }

    if (result.data.code !== booking.startCode) {
      logger.warn("Wrong start code", { bookingId: booking.id, tries: booking.startCodeAttempts + 1 });
      return res.status(400).json({ message: "Wrong code. Please check with the customer" });
    }

    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: "CONFIRMED", startedAt: null },
      data: { startedAt: new Date() },
    });
    if (updated.count === 0) {
      return res.status(400).json({ message: "This booking can't be started" });
    }

    logger.info("Work started", { bookingId: booking.id });
    return res.json({ message: "Work started" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Provider: the customer won't give the code (admin sorts it out) ----------

router.post("/:id/code-problem", allow("PROVIDER"), async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: Number(req.params.id), provider: { userId: req.user.id } },
      include: withPeople,
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.status !== "CONFIRMED" || booking.startedAt) {
      return res.status(400).json({ message: "This booking can't be started" });
    }
    if (dateText(booking) > nowInIndia().today) {
      return res.status(400).json({ message: "You can start the work on the booking date" });
    }
    if (booking.codeProblemAt) {
      return res.json({ message: "We have been told. We will contact you soon" });
    }

    await prisma.booking.update({ where: { id: booking.id }, data: { codeProblemAt: new Date() } });

    logger.warn("Start code problem reported", { bookingId: booking.id, providerId: booking.providerId });
    notifyAdmins(`Start code problem: booking #${booking.id}`, [
      `${booking.provider.user.name} says ${booking.customer.name} did not give the start code.`,
      "",
      `Booking #${booking.id}: ${booking.service.name}, ${whenText(booking.date, booking.slot)}`,
      `Provider phone: ${booking.provider.user.phone}`,
      "",
      "Please call both people, then use \"Let work start\" in Admin if the provider is there.",
    ]).catch((error) => logger.error("Emailing admins failed", { error: error.message }));

    return res.json({ message: "We have been told. We will contact you soon" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Customer: the provider did not come ----------

router.post("/:id/no-show", allow("CUSTOMER"), async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: Number(req.params.id), customerId: req.user.id },
      include: withPeople,
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.status !== "CONFIRMED" || booking.startedAt) {
      return res.status(400).json({ message: "This booking can no longer be cancelled" });
    }
    if (!slotHasEnded(dateText(booking), booking.slot)) {
      return res.status(400).json({ message: "You can report this after the booking time is over" });
    }
    // The provider said they came but got no code: we sort it out, not the customer
    if (booking.codeProblemAt) {
      return res.status(400).json({ message: "The provider says they came. We will call you both to sort this out" });
    }

    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: "CONFIRMED", startedAt: null, codeProblemAt: null },
      data: { status: "CANCELLED", slotKey: null, cancelledBy: "NO_SHOW" },
    });
    if (updated.count === 0) {
      return res.status(400).json({ message: "This booking can no longer be cancelled" });
    }

    const when = whenText(booking.date, booking.slot);
    notify(booking.provider.user.email, booking.provider.user.name, `Missed booking: ${booking.service.name}`, [
      `${booking.customer.name} says you did not come for the ${booking.service.name} booking on ${when}.`,
      "",
      "The booking is cancelled. If this is wrong, please contact us.",
    ]);
    logger.warn("Provider did not come", { bookingId: booking.id, providerId: booking.providerId });
    notifyAdmins(`Provider did not come: booking #${booking.id}`, [
      `${booking.customer.name} says ${booking.provider.user.name} did not come.`,
      "",
      `Booking #${booking.id}: ${booking.service.name}, ${when}`,
    ]).catch((error) => logger.error("Emailing admins failed", { error: error.message }));

    return res.json({ message: "Booking cancelled" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- Provider: mark job completed ----------

router.post("/:id/complete", allow("PROVIDER"), async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: Number(req.params.id), provider: { userId: req.user.id } },
      include: withPeople,
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const bookingDate = booking.date.toISOString().slice(0, 10);
    if (bookingDate > nowInIndia().today) {
      return res
        .status(400)
        .json({ message: "You can mark it completed on or after the booking date" });
    }

    if (!booking.startedAt) {
      return res.status(400).json({ message: "Enter the customer's start code first" });
    }

    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: "CONFIRMED" },
      data: { status: "COMPLETED" },
    });
    if (updated.count === 0) {
      return res.status(400).json({ message: "Only confirmed bookings can be completed" });
    }

    const provider = booking.provider.user;
    notify(booking.customer.email, booking.customer.name, `Your ${booking.service.name} work is done`, [
      `${provider.name} marked your ${booking.service.name} booking on ${whenText(booking.date, booking.slot)} as completed.`,
      "",
      ...jobLines(booking),
      "You pay online on Amader Seva.",
    ]);

    logger.info("Booking completed", { bookingId: booking.id });
    return res.json({ message: "Booking completed" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ---------- My bookings (customer or provider) ----------

router.get("/my", async (req, res) => {
  try {
    if (req.user.role === "CUSTOMER") {
      const bookings = await prisma.booking.findMany({
        where: { customerId: req.user.id, status: { not: "HELD" } },
        orderBy: { date: "desc" },
        include: {
          service: { select: { name: true } },
          job: { select: { name: true, isCheckup: true } },
          provider: { include: { user: { select: { name: true, phone: true } } } },
        },
      });
      return res.json({
        bookings: bookings.map((b) => ({
          id: b.id,
          service: b.service.name,
          date: b.date,
          slot: b.slot,
          address: b.address,
          problem: b.problem,
          job: b.job?.name || null,
          isCheckup: b.job?.isCheckup || false,
          agreedPrice: b.agreedPrice,
          maxPrice: b.maxPrice,
          status: b.status,
          replyBy: b.replyBy,
          serviceId: b.serviceId,
          pincode: b.address?.match(/(\d{6})$/)?.[1] || "",
          providerId: b.providerId,
          providerName: b.provider.user.name,
          providerSlots: b.provider.slots,
          // Phone is shared only while the job is confirmed
          providerPhone: b.status === "CONFIRMED" ? b.provider.user.phone : null,
          startCode: b.status === "CONFIRMED" && !b.startedAt ? b.startCode : null,
          startedAt: b.startedAt,
          cancelledBy: b.cancelledBy,
          cancelReason: b.cancelReason,
          codeProblem: b.status === "CONFIRMED" && !b.startedAt && Boolean(b.codeProblemAt),
          canReportNoShow: b.status === "CONFIRMED" && !b.startedAt && !b.codeProblemAt && slotHasEnded(dateText(b), b.slot),
        })),
      });
    }

    const bookings = await prisma.booking.findMany({
      where: { provider: { userId: req.user.id }, status: { not: "HELD" } },
      orderBy: { date: "asc" },
      include: {
        service: { select: { name: true } },
        job: { select: { name: true, isCheckup: true } },
        customer: { select: { name: true, phone: true } },
      },
    });
    return res.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        service: b.service.name,
        date: b.date,
        slot: b.slot,
        address: b.address,
        problem: b.problem,
        job: b.job?.name || null,
        isCheckup: b.job?.isCheckup || false,
        agreedPrice: b.agreedPrice,
        maxPrice: b.maxPrice,
        status: b.status,
        replyBy: b.replyBy,
        customerName: b.customer.name,
        customerPhone: b.status === "CONFIRMED" ? b.customer.phone : null,
        startedAt: b.startedAt,
        codeProblemAt: b.codeProblemAt,
        cancelledBy: b.cancelledBy,
        cancelReason: b.cancelReason,
        canStart: b.status === "CONFIRMED" && !b.startedAt && dateText(b) <= nowInIndia().today,
      })),
    });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;
