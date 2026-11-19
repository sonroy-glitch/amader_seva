import prisma from "./prisma.js";
import { notify, whenText } from "./email.js";
import { nowInIndia } from "./slots.js";
import logger from "./logger.js";

// Requests the provider did not answer in time: close them, free the slot and tell both people
export async function expireRequests() {
  const late = await prisma.booking.findMany({
    where: { status: "PENDING", replyBy: { lt: new Date() } },
    include: {
      service: { select: { name: true } },
      customer: { select: { name: true, email: true } },
      provider: { include: { user: { select: { name: true, email: true } } } },
    },
  });

  for (const booking of late) {
    // Only if it is still waiting (the provider may have just replied)
    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: "PENDING" },
      data: { status: "EXPIRED", slotKey: null },
    });
    if (updated.count === 0) continue;
    logger.info("Request closed, provider did not reply in time", { bookingId: booking.id, providerId: booking.providerId });

    const when = whenText(booking.date, booking.slot);
    const provider = booking.provider.user;
    notify(booking.customer.email, booking.customer.name, `${provider.name} did not reply to your booking`, [
      `${provider.name} did not reply to your ${booking.service.name} booking for ${when} in time, so the request is closed.`,
      "",
      "Please book someone else on Amader Seva.",
    ]);
    notify(provider.email, provider.name, `Request closed: ${booking.service.name}`, [
      `You did not reply to ${booking.customer.name}'s ${booking.service.name} request for ${when} in time, so it is closed and the slot is free again.`,
      "",
      "Please accept or decline new requests quickly. Customers wait for your answer.",
    ]);
  }
}

// Accepted bookings where the work never started, from 2 or more days ago:
// close them and tell both people. Open code problems are left for the admin.
export async function closeMissedBookings() {
  const yesterday = new Date(Date.parse(nowInIndia().today) - 24 * 60 * 60 * 1000);
  const missed = await prisma.booking.findMany({
    where: { status: "CONFIRMED", startedAt: null, codeProblemAt: null, date: { lt: yesterday } },
    include: {
      service: { select: { name: true } },
      customer: { select: { name: true, email: true } },
      provider: { include: { user: { select: { name: true, email: true } } } },
    },
  });

  for (const booking of missed) {
    // Only if nothing changed in the meantime
    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: "CONFIRMED", startedAt: null, codeProblemAt: null },
      data: { status: "CANCELLED", slotKey: null, cancelledBy: "NOT_STARTED" },
    });
    if (updated.count === 0) continue;
    logger.info("Booking closed, work never started", { bookingId: booking.id });

    const lines = [
      `The ${booking.service.name} booking on ${whenText(booking.date, booking.slot)} was closed because the work was never started on Amader Seva.`,
      "",
      "If the work did happen, please contact us.",
    ];
    notify(booking.customer.email, booking.customer.name, `Booking closed: ${booking.service.name}`, lines);
    notify(booking.provider.user.email, booking.provider.user.name, `Booking closed: ${booking.service.name}`, lines);
  }
}
