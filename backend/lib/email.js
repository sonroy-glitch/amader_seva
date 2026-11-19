import nodemailer from "nodemailer";
import logger from "./logger.js";

// Works with any SMTP: Gmail now, your own domain later.
// Needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM in .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Every email uses this one layout: the name on top, a white card, a small footer.
// Returns both an HTML and a plain text version (mail apps trust emails that have both).
function template({ name, lines, code, button }) {
  const hi = name ? `Hi ${name},` : "Hi,";

  // Blank lines ("") split the text into paragraphs
  const paragraphs = lines
    .join("\n")
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const codeHtml = code
    ? `<p style="margin:8px 0 24px;padding:18px 0;background:#f5efe3;border-radius:12px;text-align:center;font-family:'Courier New',monospace;font-size:40px;font-weight:bold;letter-spacing:10px;color:#1d2b25">${code}</p>`
    : "";

  const buttonHtml = button
    ? `<p style="margin:8px 0 16px"><a href="${button.link}" style="display:inline-block;padding:12px 22px;background:#1f5a4a;border-radius:10px;color:#ffffff;font-weight:bold;text-decoration:none">${button.text}</a></p>`
    : "";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f5efe3">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1d2b25">
    <p style="margin:0 0 20px;font-size:22px;font-weight:bold;color:#1f5a4a">Amader Seva</p>
    <div style="background:#ffffff;border:1px solid #e0d6c3;border-radius:16px;padding:28px 24px">
      <p style="margin:0 0 16px">${escapeHtml(hi)}</p>
      ${paragraphs}
      ${codeHtml}
      ${buttonHtml}
      <p style="margin:24px 0 0;color:#66675b">Amader Seva team</p>
    </div>
    <p style="margin:20px 0 0;font-size:13px;color:#66675b;text-align:center">Amader Seva, trusted local help near you.</p>
  </div>
</body>
</html>`;

  const parts = [hi, lines.join("\n")];
  if (code) parts.push(code);
  if (button) parts.push(`${button.text}: ${button.link}`);
  parts.push("Amader Seva team");
  const text = parts.join("\n\n");

  return { html, text };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Only the subject is logged, never the email body (it can hold a code)
async function send(to, subject, content) {
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: to,
    subject: subject,
    ...template(content),
  });
  logger.info("Email sent", { subject });
}

export async function sendOtpEmail(to, name, otp) {
  await send(to, "Reset your Amader Seva password", {
    name,
    lines: ["Use this code to reset your Amader Seva password. It works for 10 minutes."],
    code: otp,
  });
}

export async function sendSignupOtpEmail(to, otp) {
  await send(to, "Your Amader Seva sign up code", {
    lines: ["Use this code to create your Amader Seva account. It works for 10 minutes."],
    code: otp,
  });
}

// Someone tried to sign up with an email that already has an account
export async function sendAccountExistsEmail(to, name) {
  await send(to, "You already have an Amader Seva account", {
    name,
    lines: [
      "Someone tried to sign up on Amader Seva with this email, but you already have an account.",
      "",
      "Please log in instead. If you forgot your password, use \"Forgot password\" on the login page. If this was not you, you can ignore this email.",
    ],
    button: process.env.FRONTEND_URL ? { text: "Log in", link: `${process.env.FRONTEND_URL}/login` } : null,
  });
}

const SLOT_TIMES = {
  MORNING: "Morning (9 am - 12 pm)",
  AFTERNOON: "Afternoon (12 pm - 4 pm)",
  EVENING: "Evening (4 pm - 8 pm)",
};

// "Wed, 1 Oct 2026, Morning (9 am - 12 pm)"
export function whenText(date, slot) {
  const day = date.toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${day}, ${SLOT_TIMES[slot]}`;
}

// "Rs 500" or "Rs 500 - 1500"
export function priceText(min, max) {
  return max && max > min ? `Rs ${min} - ${max}` : `Rs ${min}`;
}

// "Thu, 1 Oct, 3:40 pm" in Indian time
export function timeText(date) {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Booking updates. Sent in the background: a failed email never fails the request.
export function notify(to, name, subject, lines) {
  if (!emailIsSetUp()) {
    logger.warn("Email is not set up, so this email was not sent", { subject });
    return;
  }
  const button = process.env.FRONTEND_URL
    ? { text: "Open my bookings", link: `${process.env.FRONTEND_URL}/bookings` }
    : null;
  send(to, subject, { name, lines, button }).catch((error) => logger.error("Email failed", { subject, error: error.message }));
}

export function emailIsSetUp() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_FROM
  );
}
