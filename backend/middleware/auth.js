import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

// Checks the token and puts { id, role } on req.user
export async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please login to continue" });
  }
  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: "Session expired. Please login again" });
  }

  // A blocked (or deleted) account is logged out right away,
  // and so is a login made before the password was reset
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isBlocked: true, passwordChangedAt: true },
  });
  const loggedInBeforeReset = user?.passwordChangedAt && req.user.iat < Math.floor(user.passwordChangedAt.getTime() / 1000);
  if (!user || loggedInBeforeReset) {
    return res.status(401).json({ message: "Session expired. Please login again" });
  }
  if (user.isBlocked) {
    return res.status(401).json({ message: "This account has been blocked" });
  }
  next();
}

// Only lets users with this role through
export function allow(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: `Only a ${role.toLowerCase()} can do this` });
    }
    next();
  };
}
