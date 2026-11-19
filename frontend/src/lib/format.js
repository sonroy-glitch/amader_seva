// Same slots as the backend (Indian time). Labels are translated where they are shown.
export const SLOTS = [
  { value: "MORNING", label: "Morning", time: "9 am to 12 pm", startHour: 9 },
  { value: "AFTERNOON", label: "Afternoon", time: "12 pm to 4 pm", startHour: 12 },
  { value: "EVENING", label: "Evening", time: "4 pm to 8 pm", startHour: 16 },
];

export const BENGALI_NAMES = {
  Rajmistri: "রাজমিস্ত্রি",
  Electrician: "ইলেকট্রিশিয়ান",
  Plumber: "প্লাম্বার",
  Purohit: "পুরোহিত",
  "AC/Fridge/TV Mechanic": "মেকানিক",
  Maid: "গৃহকর্মী",
};

const INDIA_OFFSET = 5.5 * 60 * 60 * 1000;
const MAX_DAYS_AHEAD = 30;

// Today's date ("YYYY-MM-DD") and the current hour in India
export function nowInIndia() {
  const india = new Date(Date.now() + INDIA_OFFSET);
  return { today: india.toISOString().slice(0, 10), hour: india.getUTCHours() };
}

export function addDays(date, days) {
  return new Date(Date.parse(date) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function lastBookableDay() {
  return addDays(nowInIndia().today, MAX_DAYS_AHEAD);
}

export function slotStarted(date, slot) {
  const { today, hour } = nowInIndia();
  const s = SLOTS.find((x) => x.value === slot);
  return date === today && hour >= s.startHour;
}

// New bookings close 2 hours before the slot starts
const MIN_HOURS_AHEAD = 2;

export function slotClosed(date, slot) {
  const { today, hour } = nowInIndia();
  const s = SLOTS.find((x) => x.value === slot);
  return date === today && hour >= s.startHour - MIN_HOURS_AHEAD;
}

// The first date + slot that can still be booked
export function firstOpenSlot() {
  const { today } = nowInIndia();
  const open = SLOTS.find((s) => !slotClosed(today, s.value));
  if (open) return { date: today, slot: open.value };
  return { date: addDays(today, 1), slot: "MORNING" };
}

// "9876543210" -> "98765 43210"
export function formatPhone(phone) {
  return phone ? `${phone.slice(0, 5)} ${phone.slice(5)}` : "";
}
