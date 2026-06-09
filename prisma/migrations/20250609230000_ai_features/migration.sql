ALTER TABLE "Objective" ADD COLUMN "businessSummary" TEXT;
ALTER TABLE "Objective" ADD COLUMN "technicalSummary" TEXT;
ALTER TABLE "Objective" ADD COLUMN "risks" TEXT;
ALTER TABLE "Objective" ADD COLUMN "architectureImpact" TEXT;

CREATE TABLE "CommitInsight" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "objectiveId" TEXT,
    "intent" TEXT NOT NULL,
    "archImpact" TEXT,
    "perfImpact" TEXT,
    "testStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommitInsight_repositoryId_sha_key" ON "CommitInsight"("repositoryId", "sha");
CREATE INDEX "CommitInsight_repositoryId_idx" ON "CommitInsight"("repositoryId");
CREATE INDEX "ChatSession_repositoryId_userId_idx" ON "ChatSession"("repositoryId", "userId");
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

ALTER TABLE "CommitInsight" ADD CONSTRAINT "CommitInsight_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommitInsight" ADD CONSTRAINT "CommitInsight_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
