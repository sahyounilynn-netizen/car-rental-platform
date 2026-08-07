import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

const CAR_BRANDS = ["BMW", "Audi", "Mercedes-Benz", "Toyota", "Honda", "Ford", "Tesla", "Hyundai"];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@carrental.dev" },
    update: {},
    create: {
      name: "Platform SuperAdmin",
      email: "superadmin@carrental.dev",
      passwordHash,
      role: "SUPERADMIN",
    },
  });

  await Promise.all(
    CAR_BRANDS.map((name) =>
      prisma.carBrand.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  const shopSeeds = [
    {
      adminEmail: "admin.downtown@carrental.dev",
      adminName: "Dana Downtown",
      shopName: "Downtown Motors",
      address: "12 Market St, Springfield",
      phone: "+15551230001",
    },
    {
      adminEmail: "admin.airport@carrental.dev",
      adminName: "Alex Airport",
      shopName: "Airport Rentals",
      address: "1 Terminal Way, Springfield",
      phone: "+15551230002",
    },
  ];

  for (const seed of shopSeeds) {
    const admin = await prisma.user.upsert({
      where: { email: seed.adminEmail },
      update: {},
      create: {
        name: seed.adminName,
        email: seed.adminEmail,
        passwordHash,
        role: "ADMIN",
      },
    });

    await prisma.shop.upsert({
      where: { ownerId: admin.id },
      update: {},
      create: {
        ownerId: admin.id,
        name: seed.shopName,
        description: `${seed.shopName} — demo shop seeded for local development.`,
        address: seed.address,
        phone: seed.phone,
      },
    });
  }

  const demoUsers = [
    { name: "Uma User", email: "user1@carrental.dev" },
    { name: "Ivan Renter", email: "user2@carrental.dev" },
    { name: "Priya Traveler", email: "user3@carrental.dev" },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: "USER",
      },
    });
  }

  console.log("Seed complete.");
  console.log(`All seeded accounts share the password: ${DEMO_PASSWORD}`);
  console.log(`SuperAdmin: ${superAdmin.email}`);
  console.log(`Admins: ${shopSeeds.map((s) => s.adminEmail).join(", ")}`);
  console.log(`Users: ${demoUsers.map((u) => u.email).join(", ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
