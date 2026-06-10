CREATE TYPE "WorkflowStatus" AS ENUM ('GENERATING_PLANS', 'AWAITING_PLAN_APPROVAL', 'RUNNING_AGENT', 'EVALUATING', 'AWAITING_DECISION_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "ObjectiveWorkflow" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'GENERATING_PLANS',
    "model" TEXT NOT NULL,
    "selectedPlanId" TEXT,
    "agentRunId" TEXT,
    "recommendedPlanId" TEXT,
    "recommendedRationale" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectiveWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ObjectiveWorkflow_objectiveId_key" ON "ObjectiveWorkflow"("objectiveId");

CREATE INDEX "ObjectiveWorkflow_status_idx" ON "ObjectiveWorkflow"("status");

ALTER TABLE "ObjectiveWorkflow" ADD CONSTRAINT "ObjectiveWorkflow_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ObjectiveWorkflow" ADD CONSTRAINT "ObjectiveWorkflow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
