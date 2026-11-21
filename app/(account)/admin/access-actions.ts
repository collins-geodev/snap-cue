"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { authenticatedClient } from "@/lib/server-auth";

export async function reviewAccessRequest(form: FormData) {
  const session = await authenticatedClient();
  if (!session) redirect("/sign-in");
  if (!(await session.client.query(api.admin.overview, {}))) notFound();

  const id = form.get("entry");
  const decision = form.get("decision");
  if (typeof id !== "string" || !/^[a-z]+_[a-zA-Z0-9]{8,80}$/.test(id) || (decision !== "approve" && decision !== "decline")) {
    redirect("/admin?access=invalid");
  }

  let outcome: string;
  try {
    const { waitlistEntries } = await clerkClient();
    const { data } = await waitlistEntries.list({ query: id, status: "pending", limit: 1 });
    if (!data.some(entry => entry.id === id && !entry.isLocked)) {
      outcome = "reviewed";
    } else if (decision === "approve") {
      await waitlistEntries.invite(id);
      outcome = "approved";
    } else {
      await waitlistEntries.reject(id);
      outcome = "declined";
    }
  } catch {
    outcome = "error";
  }
  redirect("/admin?access=" + outcome);
}
