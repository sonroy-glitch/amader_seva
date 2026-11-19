// Usage: npm run make-admin -- you@email.com
// Sign up normally as a customer first, then run this to make that account an admin.
import prisma from "../lib/prisma.js";

const email = process.argv[2]?.toLowerCase();
if (!email) {
  console.log("Usage: npm run make-admin -- you@email.com");
  process.exit(1);
}

const user = await prisma.user.findUnique({
  where: { email },
  include: { provider: true },
});

if (!user) {
  console.log("No account found for this email. Sign up first.");
} else if (user.provider) {
  console.log("This is a provider account. Use a separate account for admin.");
} else {
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });
  console.log(`${email} is now an admin. Log out and log in again.`);
}

await prisma.$disconnect();
