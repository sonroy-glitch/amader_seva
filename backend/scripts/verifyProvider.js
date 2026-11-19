// Usage: npm run verify-provider -- provider@email.com
import prisma from "../lib/prisma.js";

const email = process.argv[2]?.toLowerCase();
if (!email) {
  console.log("Usage: npm run verify-provider -- provider@email.com");
  process.exit(1);
}

const provider = await prisma.provider.findFirst({
  where: { user: { email } },
});

if (!provider) {
  console.log("No provider profile found for this email");
} else {
  await prisma.provider.update({
    where: { id: provider.id },
    data: { isVerified: true },
  });
  console.log(`Verified provider: ${email}`);
}

await prisma.$disconnect();
