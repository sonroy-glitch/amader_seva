import express from "express";
import crypto from "node:crypto";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import prisma from "../lib/prisma.js";
import { auth } from "../middleware/auth.js";
import { sendOtpEmail, sendSignupOtpEmail, sendAccountExistsEmail, emailIsSetUp } from "../lib/email.js";
import logger from "../lib/logger.js";

const router = express.Router();

const saltRounds = 10;
const OTP_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

// 10 failed tries per 15 minutes from one IP (successful logins don't count)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { message: "Too many attempts. Please try again after 15 minutes" },
});

// 5 OTP requests per hour from one IP (stops email spamming)
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { message: "Too many OTP requests. Please try again after an hour" },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email").trim().toLowerCase(),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["CUSTOMER", "PROVIDER"]),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6 digit code from the email"),
});

const signupOtpSchema = z.object({
  email: z.email("Invalid email").trim().toLowerCase(),
});

const accountSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number"),
});

const loginSchema = z.object({
  email: z.email("Invalid email").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

const forgotSchema = z.object({
  email: z.email("Invalid email").trim().toLowerCase(),
});

const resetSchema = z.object({
  email: z.email("Invalid email").trim().toLowerCase(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

function makeToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
}

// Sign up step 1: email a code, to check the email is real
router.post("/signup-otp", otpLimiter, async (req, res) => {
  try {
    const result = signupOtpSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    if (!emailIsSetUp()) {
      return res.status(503).json({ message: "Sign up is not available right now" });
    }
    const { email } = result.data;

    // Same reply whether the email is registered or not, so no one can check who has an account.
    // An existing user gets an email telling them to log in instead.
    const reply = { message: "We have sent a code to your email" };

    const checkUser = await prisma.user.findUnique({ where: { email } });
    if (checkUser) {
      await sendAccountExistsEmail(checkUser.email, checkUser.name);
      return res.json(reply);
    }

    // Don't send a new email if one was sent in the last minute
    const old = await prisma.signupOtp.findUnique({ where: { email } });
    if (old && old.expiresAt.getTime() - Date.now() > (OTP_MINUTES - 1) * 60 * 1000) {
      return res.json(reply);
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const data = {
      otp: await bcrypt.hash(otp, saltRounds),
      expiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000),
      attempts: 0,
    };
    await prisma.signupOtp.upsert({
      where: { email },
      create: { email, ...data },
      update: data,
    });
    logger.info("Sign up code sent", { ip: req.ip });
    await sendSignupOtpEmail(email, otp);

    return res.json(reply);
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Could not send the code. Please try again" });
  }
});

// Sign up step 2: check the code and create the account
router.post("/register", loginLimiter, async (req, res) => {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const { name, email, phone, password, role, otp } = result.data;

    // A registered email never gets a sign up code, so it stops here too
    const signupOtp = await prisma.signupOtp.findUnique({ where: { email } });
    const otpUsable = signupOtp && signupOtp.expiresAt > new Date() && signupOtp.attempts < MAX_OTP_ATTEMPTS;
    if (!otpUsable) {
      return res.status(400).json({ message: "Code is invalid or expired. Please request a new one" });
    }
    const otpCheck = await bcrypt.compare(otp, signupOtp.otp);
    if (!otpCheck) {
      await prisma.signupOtp.update({
        where: { email },
        data: { attempts: { increment: 1 } },
      });
      logger.warn("Wrong sign up code", { ip: req.ip });
      return res.status(400).json({ message: "Wrong code" });
    }
    const hashed_password = await bcrypt.hash(password, saltRounds);
    const user = await prisma.user.create({
      data: {
        name: name,
        email: email,
        phone: phone,
        password: hashed_password,
        role: role,
      },
    });
    await prisma.signupOtp.delete({ where: { email } });

    logger.info("New account created", { userId: user.id, role: user.role });
    return res.status(201).json({
      token: makeToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    // Two sign-ups with the same email at the same moment
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ message: "User already exists with this email. Please login to continue" });
    }
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const { email, password } = result.data;
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      logger.warn("Failed login: no account with this email", { ip: req.ip });
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const passCheck = await bcrypt.compare(password, user.password);
    if (!passCheck) {
      logger.warn("Failed login: wrong password", { userId: user.id, ip: req.ip });
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (user.isBlocked) {
      logger.warn("Blocked account tried to log in", { userId: user.id, ip: req.ip });
      return res.status(403).json({ message: "This account has been blocked" });
    }
    logger.info("Logged in", { userId: user.id });
    return res.json({
      token: makeToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Step 1: email an OTP to this account
router.post("/forgot-password", otpLimiter, async (req, res) => {
  try {
    const result = forgotSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    if (!emailIsSetUp()) {
      return res.status(503).json({ message: "Password reset is not available right now" });
    }

    // Same reply whether the email exists or not
    const reply = { message: "If this email is registered, an OTP has been sent to it" };

    const user = await prisma.user.findUnique({
      where: { email: result.data.email },
    });
    if (!user) {
      return res.json(reply);
    }

    // Don't send a new email if one was sent in the last minute
    const sentRecently =
      user.resetOtpExpiresAt &&
      user.resetOtpExpiresAt.getTime() - Date.now() > (OTP_MINUTES - 1) * 60 * 1000;
    if (sentRecently) {
      return res.json(reply);
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetOtp: await bcrypt.hash(otp, saltRounds),
        resetOtpExpiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000),
        resetOtpAttempts: 0,
      },
    });
    logger.info("Password reset code sent", { userId: user.id });
    await sendOtpEmail(user.email, user.name, otp);

    return res.json(reply);
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Could not send OTP. Please try again" });
  }
});

// Step 2: check the OTP and set the new password
router.post("/reset-password", loginLimiter, async (req, res) => {
  try {
    const result = resetSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const { email, otp, newPassword } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });
    const otpUsable =
      user &&
      user.resetOtp &&
      user.resetOtpExpiresAt > new Date() &&
      user.resetOtpAttempts < MAX_OTP_ATTEMPTS;
    if (!otpUsable) {
      return res.status(400).json({ message: "OTP is invalid or expired. Please request a new one" });
    }

    const otpCheck = await bcrypt.compare(otp, user.resetOtp);
    if (!otpCheck) {
      await prisma.user.update({
        where: { id: user.id },
        data: { resetOtpAttempts: { increment: 1 } },
      });
      logger.warn("Wrong password reset code", { userId: user.id, ip: req.ip });
      return res.status(400).json({ message: "Wrong OTP" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(newPassword, saltRounds),
        passwordChangedAt: new Date(),
        resetOtp: null,
        resetOtpExpiresAt: null,
        resetOtpAttempts: 0,
      },
    });
    logger.info("Password reset", { userId: user.id });
    return res.json({ message: "Password changed. Please login with your new password" });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Account settings: change name and phone
router.put("/me", auth, async (req, res) => {
  try {
    const result = accountSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: result.data,
    });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    logger.error(`${req.method} ${req.originalUrl} failed`, { error: error.message, stack: error.stack });
    return res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;
