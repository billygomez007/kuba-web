import { db } from "../db";
import { skills } from "../db/schema";

async function seedSkills() {

  const now = new Date();

  await db.insert(skills).values([
    {
      id: crypto.randomUUID(),
      name: "Lead Qualification Skill",
      slug: "lead-qualification",
      description:
        "Helps AI employees identify valuable prospects and score leads.",
      category: "Sales",
      type: "kuba_official",
      version: "1.0",
      instructions:
        "Analyze customer conversations, identify buying signals, score leads, and recommend follow-up actions.",
      tools:
        "lead_scoring, customer_analysis",
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      name: "Customer Support Skill",
      slug: "customer-support",
      description:
        "Enables AI employees to handle customer questions and support requests.",
      category: "Support",
      type: "kuba_official",
      version: "1.0",
      instructions:
        "Provide helpful answers, resolve issues, and escalate when necessary.",
      tools:
        "customer_history, knowledge_search",
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      name: "Sales Follow-up Skill",
      slug: "sales-follow-up",
      description:
        "Allows AI employees to manage follow-ups and customer engagement.",
      category: "Sales",
      type: "kuba_official",
      version: "1.0",
      instructions:
        "Create follow-ups, maintain engagement, and move customers through the sales process.",
      tools:
        "followups, messaging",
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
  ])
  .onConflictDoNothing();

  console.log("Skills seeded successfully.");
}

seedSkills()
.then(() => process.exit(0))
.catch((error)=>{
 console.error(error);
 process.exit(1);
});
