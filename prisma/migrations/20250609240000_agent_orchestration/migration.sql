ALTER TABLE "Repository" ADD COLUMN "agentSystemPrompt" TEXT;

ALTER TABLE "AgentRun" ADD COLUMN "promptTokens" INTEGER;
ALTER TABLE "AgentRun" ADD COLUMN "completionTokens" INTEGER;
ALTER TABLE "AgentRun" ADD COLUMN "errorMessage" TEXT;
