import { redirect } from "next/navigation";
import { authorized } from "@/lib/auth";
import {
  readJournalLocation,
  writeJournalLocation,
} from "@/lib/journal/journal-location";
import { JournalApp } from "@/components/journal/journal-app";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value))
      value.forEach((item) => params.append(key, item));
  }
  const initialLocation = readJournalLocation(params);
  try {
    await authorized();
  } catch {
    const next = "/?" + writeJournalLocation(initialLocation);
    redirect("/login?next=" + encodeURIComponent(next));
  }
  return <JournalApp initialLocation={initialLocation} />;
}
