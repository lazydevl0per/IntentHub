import type { Session } from "next-auth";

export const DEMO_USER_ID = "demo-user";

export const DEMO_SESSION: Session = {
  user: {
    id: DEMO_USER_ID,
    name: "Demo User",
    email: "demo@intenthub.dev",
  },
  expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
};

export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

export function isDemoModeClient() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
