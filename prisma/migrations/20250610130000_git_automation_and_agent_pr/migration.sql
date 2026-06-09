CREATE TYPE "PullRequestState" AS ENUM ('OPEN', 'CLOSED', 'MERGED');

ALTER TABLE "AgentRun" ADD COLUMN "pullRequestUrl" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "pullRequestNumber" INTEGER;
ALTER TABLE "AgentRun" ADD COLUMN "filesChanged" INTEGER;

CREATE TABLE "GitPullRequest" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "state" "PullRequestState" NOT NULL,
    "headBranch" TEXT NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3),
    "objectiveId" TEXT,
    "agentRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitPullRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GitTag" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RepositoryInvite" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "RepositoryRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "objectiveId" TEXT,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitPullRequest_agentRunId_key" ON "GitPullRequest"("agentRunId");
CREATE UNIQUE INDEX "GitPullRequest_repositoryId_number_key" ON "GitPullRequest"("repositoryId", "number");
CREATE INDEX "GitPullRequest_repositoryId_state_idx" ON "GitPullRequest"("repositoryId", "state");
CREATE UNIQUE INDEX "GitTag_repositoryId_name_key" ON "GitTag"("repositoryId", "name");
CREATE UNIQUE INDEX "RepositoryInvite_token_key" ON "RepositoryInvite"("token");
CREATE UNIQUE INDEX "RepositoryInvite_repositoryId_email_key" ON "RepositoryInvite"("repositoryId", "email");
CREATE INDEX "Deployment_repositoryId_deployedAt_idx" ON "Deployment"("repositoryId", "deployedAt");

ALTER TABLE "GitPullRequest" ADD CONSTRAINT "GitPullRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitPullRequest" ADD CONSTRAINT "GitPullRequest_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GitPullRequest" ADD CONSTRAINT "GitPullRequest_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GitTag" ADD CONSTRAINT "GitTag_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepositoryInvite" ADD CONSTRAINT "RepositoryInvite_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepositoryInvite" ADD CONSTRAINT "RepositoryInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
