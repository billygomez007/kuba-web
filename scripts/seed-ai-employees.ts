import { db } from "../db";
import { aiEmployeeTemplates } from "../db/schema";

async function seed() {
  const employees = [
    {
      id: crypto.randomUUID(),
      name: "Kuba Receptionist",
      type: "receptionist",
      description:
        "Handles customer enquiries, captures information, answers common questions, and routes conversations.",
      version: "1.0",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: crypto.randomUUID(),
      name: "Kuba Sales",
      type: "sales",
      description:
        "Qualifies leads, manages follow-ups, engages prospects, and supports revenue growth.",
      version: "1.0",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.insert(aiEmployeeTemplates).values(employees);

  console.log("Kuba AI employees seeded.");
}

seed();
