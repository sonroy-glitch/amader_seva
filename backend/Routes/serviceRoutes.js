import express from "express";
import prisma from "../lib/prisma.js";
import logger from "../lib/logger.js";

const router = express.Router();

// The services rarely change, so keep them in memory for 10 minutes.
// The home page then loads fast even while the database is asleep.
const TEN_MINUTES = 10 * 60 * 1000;
let cached = null;
let cachedAt = 0;

// All services and their jobs, for the home page and the provider's price list
router.get("/", async (req, res) => {
  try {
    if (!cached || Date.now() - cachedAt > TEN_MINUTES) {
      cached = await prisma.service.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          jobs: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isCheckup: true } },
        },
      });
      cachedAt = Date.now();
    }
    return res.json({ services: cached });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;
