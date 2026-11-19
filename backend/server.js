import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./Routes/authRoutes.js";
import serviceRoutes from "./Routes/serviceRoutes.js";
import providersRoutes from "./Routes/providersRoutes.js";
import bookingRoutes from "./Routes/bookingRoutes.js";
import adminRoutes from "./Routes/adminRoutes.js";
import addressRoutes from "./Routes/addressRoutes.js";
import { closeMissedBookings, expireRequests } from "./lib/requests.js";
import logger from "./lib/logger.js";

const app = express();

// Behind a hosting proxy (Render, Railway and so on) this gives the real visitor IP for the rate limits
app.set("trust proxy", 1);

// Safe default security headers
app.use(helmet());

// In production set FRONTEND_URL so only your site can call the API
app.use(cors({ origin: process.env.FRONTEND_URL || true }));

// 300 requests per 15 minutes from one IP, for the whole API
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    message: { message: "Too many requests. Please try again after a few minutes" },
  })
);

// Request bodies are small forms; anything bigger is refused
app.use(express.json({ limit: "20kb" }));

// One line per request: method, path, status, time taken, IP
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`;
    const meta = { ip: req.ip, userId: req.user?.id };
    if (res.statusCode >= 500) logger.error(line, meta);
    else if (res.statusCode >= 400) logger.warn(line, meta);
    else logger.info(line, meta);
  });
  next();
});

// Scheduled cleanup for serverless hosting (Vercel Cron calls this; see vercel.json).
// Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
app.get("/api/cron/cleanup", async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  await Promise.all([expireRequests(), closeMissedBookings()]);
  return res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/providers", providersRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/addresses", addressRoutes);

// Broken JSON in the request body, or any error a route didn't catch
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON" });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large" });
  }
  logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
  return res.status(500).json({ message: "Something went wrong" });
});

// Every 5 minutes, close requests the provider did not answer in time,
// and old accepted bookings where the work never started
function closeLateRequests() {
  expireRequests().catch((error) => logger.error("Closing late requests failed", { error: error.message, stack: error.stack }));
  closeMissedBookings().catch((error) => logger.error("Closing missed bookings failed", { error: error.message, stack: error.stack }));
}

// On Vercel the app runs as a serverless function: Vercel imports the exported app,
// there is no long-running server, and the cleanup runs from Vercel Cron instead.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  closeLateRequests();
  setInterval(closeLateRequests, 5 * 60 * 1000);

  // Anything that slipped past every catch, so it is never lost
  process.on("unhandledRejection", (error) => {
    logger.error("Unhandled promise rejection", { error: error?.message, stack: error?.stack });
  });
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception, server stopping", { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

export default app;
