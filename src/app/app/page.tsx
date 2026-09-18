import { CompanionApp } from "@/components/CompanionApp";
import { requireUser } from "@/server/session";

export const metadata = { title: "Call | lonely-gotchi" };

export default async function CallPage() {
  const user = await requireUser();
  return <CompanionApp userName={user.name} />;
}
