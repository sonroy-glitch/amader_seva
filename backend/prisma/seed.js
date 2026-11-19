import prisma from "../lib/prisma.js";

const CHECKUP = "Not sure, needs checking";

// Each service and the jobs customers can choose. Providers set their own price for each job.
// CHECKUP is priced with the provider's visit charge.
const services = [
  {
    name: "Rajmistri",
    description: "House construction and repair work",
    jobs: [
      "Wall crack or plaster repair",
      "Floor or wall tile work",
      "Roof leak repair",
      "Damp wall repair",
      "Small brick work",
      CHECKUP,
    ],
  },
  {
    name: "Electrician",
    description: "Electrical wiring, fittings and repairs",
    jobs: [
      "Fan install or repair",
      "Switch or socket repair",
      "Light fitting install",
      "MCB or fuse repair",
      "New wiring (per point)",
      "Inverter or stabiliser install",
      "Geyser install",
      CHECKUP,
    ],
  },
  {
    name: "Plumber",
    description: "Pipe, tap and water line work",
    jobs: [
      "Tap repair or replace",
      "Leaking pipe repair",
      "Blocked drain or sink",
      "Toilet or flush repair",
      "Water motor install or repair",
      "Water tank cleaning",
      CHECKUP,
    ],
  },
  {
    name: "Purohit",
    description: "Puja and religious ceremonies",
    jobs: ["Satyanarayan Puja", "Lakshmi Puja", "Griha Pravesh", "Annaprashan", "Shraddha", "Wedding", "Other puja"],
  },
  {
    name: "AC/Fridge/TV Mechanic",
    description: "Appliance repair and servicing",
    jobs: [
      "AC service (cleaning)",
      "AC gas refill",
      "AC install or uninstall",
      "Fridge repair",
      "Washing machine repair",
      "TV repair",
      "TV wall mounting",
      CHECKUP,
    ],
  },
  {
    name: "Maid",
    description: "Home cleaning and household help",
    jobs: ["House cleaning (per visit)", "Kitchen deep cleaning", "Bathroom deep cleaning"],
  },
];

for (const { jobs, ...service } of services) {
  const saved = await prisma.service.upsert({
    where: { name: service.name },
    create: service,
    update: { description: service.description },
  });

  for (const [index, name] of jobs.entries()) {
    await prisma.serviceJob.upsert({
      where: { serviceId_name: { serviceId: saved.id, name } },
      create: { serviceId: saved.id, name, isCheckup: name === CHECKUP, sortOrder: index },
      update: { isCheckup: name === CHECKUP, sortOrder: index },
    });
  }
}

console.log(`Seeded ${services.length} services and their jobs`);
await prisma.$disconnect();
