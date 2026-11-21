import { notFound } from "next/navigation";
import { Studio, type View } from "@/components/studio";
const views = ["dashboard", "profile", "jobs", "practice", "assistant", "live", "history", "settings"] as const;
export default async function Page({ params }: { params: Promise<{ view?: string[] }> }) {
  const { view } = await params;
  const selected = view?.[0] ?? "dashboard";
  if ((view?.length ?? 0) > 1 || !views.includes(selected as View)) notFound();
  return <Studio view={selected as View} />;
}
