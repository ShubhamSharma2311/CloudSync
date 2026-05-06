// One-off smoke test: pick a known-violating seeded resource (the AWS zombie API
// EC2) + the AWS COMPUTE rules, ask Gemini to analyze, print the result.
// Not part of the app — run manually via:  npx tsx scripts/test_agent.ts
import "dotenv/config";
import { getPrisma } from "../src/db/prisma";
import { analyzeResource } from "../src/agent/gemini";

async function main() {
  const prisma = getPrisma();

  const zombieEc2 = await prisma.resource.findFirst({
    where: { name: "api-worker-legacy" }, // a seeded zombie EC2
  });
  if (!zombieEc2) throw new Error("Seeded zombie EC2 not found — run db seed first");

  const rules = await prisma.securityPolicy.findMany({
    where: {
      provider: zombieEc2.provider,
      metadata: { path: ["resourceType"], equals: zombieEc2.resourceType },
    },
    take: 30,
  });

  console.log(`Resource: ${zombieEc2.name} (${zombieEc2.provider} / ${zombieEc2.resourceType}, status=${zombieEc2.status})`);
  console.log(`Rules to consider: ${rules.length}\n`);

  const proposal = await analyzeResource(zombieEc2, rules);

  console.log("=== Gemini proposal ===");
  console.log(JSON.stringify(proposal, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
