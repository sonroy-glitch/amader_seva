import winston from "winston";

// One logger for the whole app.
// Prints to the terminal, and keeps logs/app.log (everything) and logs/error.log (errors only).
// On Vercel the disk is read-only, so only the console is used (Vercel keeps those logs).
// Never log passwords, OTPs, start codes or tokens.
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    ...(process.env.VERCEL
      ? []
      : [
          new winston.transports.File({ filename: "logs/error.log", level: "error", maxsize: 5 * 1024 * 1024, maxFiles: 5 }),
          new winston.transports.File({ filename: "logs/app.log", maxsize: 5 * 1024 * 1024, maxFiles: 5 }),
        ]),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} ${level}: ${message}${extra}${stack ? `\n${stack}` : ""}`;
        })
      ),
    }),
  ],
});

export default logger;
