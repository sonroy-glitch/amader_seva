import express from "express";
import prisma from "../lib/prisma.js";
import { auth, allow } from "../middleware/auth.js";
import logger from "../lib/logger.js";

const router = express.Router();

router.use(auth, allow("CUSTOMER"));

// My saved addresses, newest first
router.get("/", async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, house: true, area: true, landmark: true, city: true, pincode: true },
    });
    return res.json({ addresses });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Remove one of my saved addresses
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ message: "Address not found" });
    }
    await prisma.address.deleteMany({ where: { id, userId: req.user.id } });
    return res.json({ message: "Address removed" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;
