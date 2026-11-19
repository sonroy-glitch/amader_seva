// Usage: npm run create-admin
// Creates a new admin account straight from the terminal. No sign up on the website needed.
import readline from "node:readline/promises";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const name = (await rl.question("Name: ")).trim();
const email = (await rl.question("Email: ")).trim().toLowerCase();
const phone = (await rl.question("Phone (10 digits): ")).trim();
const password = await rl.question("Password (at least 6 characters): ");
rl.close();

if (name.length < 2) {
  console.log("Name must be at least 2 characters.");
} else if (!/^\S+@\S+\.\S+$/.test(email)) {
  console.log("Invalid email.");
} else if (!/^[6-9]\d{9}$/.test(phone)) {
  console.log("Invalid phone number.");
} else if (password.length < 6) {
  console.log("Password must be at least 6 characters.");
} else if (await prisma.user.findUnique({ where: { email } })) {
  console.log("An account with this email already exists. Use npm run make-admin -- " + email + " instead.");
} else {
  await prisma.user.create({
    data: { name, email, phone, password: await bcrypt.hash(password, 10), role: "ADMIN" },
  });
  console.log(`Admin account created. Log in on the website with ${email}.`);
}

await prisma.$disconnect();
