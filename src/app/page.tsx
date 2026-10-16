import { redirect } from "next/navigation";
import { authorized } from "@/lib/auth";
import { JournalApp } from "@/components/journal-app";
export const dynamic = "force-dynamic";
export default async function Home() {
  try {
    await authorized();
  } catch {
    redirect("/login");
  }
  return <JournalApp />;
}
