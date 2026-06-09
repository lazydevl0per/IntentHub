import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const objectiveSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export const planSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  approach: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "REJECTED", "SELECTED"]).optional(),
});

export const executeAgentRunSchema = z.object({
  planId: z.string().min(1),
  agentName: z.string().min(1).max(100).optional(),
  model: z.string().max(100).optional(),
});

export const agentRunSchema = z.object({
  planId: z.string().optional(),
  agentName: z.string().min(1).max(100),
  model: z.string().max(100).optional(),
  prompt: z.string().min(1),
  output: z.string().min(1),
  branchName: z.string().max(200).optional(),
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED"]).optional(),
});

export const evaluationSchema = z.object({
  planId: z.string().optional(),
  agentRunId: z.string().optional(),
  type: z.enum(["TEST", "BENCHMARK", "SECURITY", "QUALITY"]),
  score: z.number().min(0).max(100),
  summary: z.string().min(1),
  rawJson: z.record(z.string(), z.unknown()).optional(),
});

export const decisionSchema = z.object({
  selectedPlanId: z.string().min(1),
  rationale: z.string().min(1),
  linkedCommitSha: z.string().optional(),
});

export const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

export const connectRepoSchema = z.object({
  githubId: z.number(),
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  defaultBranch: z.string().optional(),
});

export const repositorySettingsSchema = z.object({
  agentSystemPrompt: z.string().max(8000).nullable().optional(),
});
