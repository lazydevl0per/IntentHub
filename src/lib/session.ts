import { auth } from "@/lib/auth";
import { DEMO_SESSION, isDemoMode } from "@/lib/demo";

export async function getAppSession() {
  if (isDemoMode()) return DEMO_SESSION;
  return auth();
}
