import { AppShell } from "@/components/shell/AppShell";
import { requireUser } from "@/server/session";

// Everything under /app requires a signed-in user.
export default async function PlatformLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  return <AppShell user={{ name: user.name, email: user.email }}>{children}</AppShell>;
}
