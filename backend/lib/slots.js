// Time slots (Indian time): Morning 9-12, Afternoon 12-4, Evening 4-8
export const SLOTS = ["MORNING", "AFTERNOON", "EVENING"];
const SLOT_START_HOUR = { MORNING: 9, AFTERNOON: 12, EVENING: 16 };
const SLOT_END_HOUR = { MORNING: 12, AFTERNOON: 16, EVENING: 20 };

export const HOLD_MINUTES = 5;
const MAX_DAYS_AHEAD = 30;
// A slot closes for new bookings this many hours before it starts,
// so the provider has time to reply and get there
const MIN_HOURS_AHEAD = 2;
const INDIA_OFFSET = 5.5 * 60 * 60 * 1000;

// Today's date ("YYYY-MM-DD") and current hour in India
export function nowInIndia() {
  const india = new Date(Date.now() + INDIA_OFFSET);
  return { today: india.toISOString().slice(0, 10), hour: india.getUTCHours() };
}

// Returns an error message if this date + slot can't be booked, otherwise null
export function checkBookable(date, slot) {
  const { today, hour } = nowInIndia();
  const lastDay = new Date(Date.parse(today) + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  if (date < today) return "This date has already passed";
  if (date > lastDay) return `You can book up to ${MAX_DAYS_AHEAD} days ahead`;
  if (date === today && hour >= SLOT_START_HOUR[slot]) return "This slot has already started";
  if (date === today && hour >= SLOT_START_HOUR[slot] - MIN_HOURS_AHEAD) return "This slot starts too soon. Please choose a later slot";
  return null;
}

// True once the slot's start time has come (date is "YYYY-MM-DD")
export function slotHasStarted(date, slot) {
  const { today, hour } = nowInIndia();
  return date < today || (date === today && hour >= SLOT_START_HOUR[slot]);
}

// True once the slot's time window is over
export function slotHasEnded(date, slot) {
  const { today, hour } = nowInIndia();
  return date < today || (date === today && hour >= SLOT_END_HOUR[slot]);
}

// Same provider + date + slot always gives the same key, so the database
// unique rule on slotKey allows only one active booking per slot.
export function makeSlotKey(providerId, date, slot) {
  return `${providerId}-${date}-${slot}`;
}

// The provider must reply within 24 hours, or before the slot starts if that is sooner
export const REPLY_HOURS = 24;

export function replyDeadline(date, slot) {
  const slotStart = new Date(new Date(date).getTime() + SLOT_START_HOUR[slot] * 60 * 60 * 1000 - INDIA_OFFSET);
  const dayLater = new Date(Date.now() + REPLY_HOURS * 60 * 60 * 1000);
  return slotStart < dayLater ? slotStart : dayLater;
}
