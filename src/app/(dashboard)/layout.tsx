import { AppShell } from "@/components/app-shell";
import { isDemoMode } from "@/lib/demo";
import { getAppSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell
      userName={session.user.name ?? session.user.email}
      demoMode={isDemoMode()}
    >
      {children}
    </AppShell>
  );
}
