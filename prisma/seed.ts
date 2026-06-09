import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@intenthub.dev" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@intenthub.dev",
      passwordHash,
    },
  });

  const repository = await prisma.repository.upsert({
    where: { githubId: 10001 },
    update: {},
    create: {
      githubId: 10001,
      owner: "intenthub",
      name: "demo-app",
      fullName: "intenthub/demo-app",
      defaultBranch: "main",
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  });

  const objective = await prisma.objective.upsert({
    where: { id: "seed-objective-1" },
    update: {},
    create: {
      id: "seed-objective-1",
      title: "Reduce API latency by 50%",
      description:
        "Improve API response times for the top 10 endpoints used by customers.",
      status: "ACTIVE",
      priority: "HIGH",
      repositoryId: repository.id,
      creatorId: user.id,
    },
  });

  const planA = await prisma.plan.create({
    data: {
      objectiveId: objective.id,
      title: "Add Redis caching",
      description: "Cache frequent read queries in Redis.",
      approach: "Introduce Redis layer in front of PostgreSQL for hot paths.",
      status: "ACTIVE",
      createdById: user.id,
    },
  });

  const planB = await prisma.plan.create({
    data: {
      objectiveId: objective.id,
      title: "Optimize database indexes",
      description: "Add composite indexes for slow queries.",
      approach: "Analyze query plans and add targeted indexes.",
      status: "ACTIVE",
      createdById: user.id,
    },
  });

  await prisma.agentRun.create({
    data: {
      objectiveId: objective.id,
      planId: planA.id,
      agentName: "Cursor Agent",
      model: "gpt-4o",
      prompt: "Implement Redis caching for /api/users endpoint",
      output: "Added Redis client, cache middleware, and TTL configuration.",
      branchName: "feat/redis-cache",
      status: "COMPLETED",
      createdById: user.id,
    },
  });

  await prisma.evaluation.create({
    data: {
      objectiveId: objective.id,
      planId: planA.id,
      type: "BENCHMARK",
      score: 92,
      summary: "P95 latency reduced from 420ms to 158ms (62% improvement).",
      createdById: user.id,
    },
  });

  await prisma.gitCommit.create({
    data: {
      repositoryId: repository.id,
      sha: "a1b2c3d4e5f6789012345678abcdef9012345678",
      message: "feat: add Redis caching layer",
      author: "Demo User",
      committedAt: new Date(),
      parentShas: [],
    },
  });

  await prisma.decision.upsert({
    where: { objectiveId: objective.id },
    update: {},
    create: {
      objectiveId: objective.id,
      selectedPlanId: planA.id,
      rationale:
        "Redis caching delivered the largest latency improvement with acceptable operational complexity compared to index-only optimization.",
      linkedCommitSha: "a1b2c3d",
      approvedById: user.id,
    },
  });

  await prisma.objective.update({
    where: { id: objective.id },
    data: { status: "COMPLETED" },
  });

  await prisma.plan.update({
    where: { id: planA.id },
    data: { status: "SELECTED" },
  });

  await prisma.plan.update({
    where: { id: planB.id },
    data: { status: "REJECTED" },
  });

  console.log("Seed complete");
  console.log("Login: demo@intenthub.dev / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
