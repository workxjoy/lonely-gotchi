import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";

// Public auth pages; already signed-in users go straight to the app.
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getCurrentUser()) redirect("/app");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" className="text-xl font-bold tracking-tight">
        lonely-gotchi
      </Link>
      {children}
    </div>
  );
}
