import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Give up on a stuck connection after 15 seconds instead of waiting about a minute.
// Neon puts the database to sleep when idle, and waking it can sometimes hang.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});
const prisma = new PrismaClient({ adapter });

export default prisma;
