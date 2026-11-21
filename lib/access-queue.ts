import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

export async function pendingAccessQueue() {
  const clerk = await clerkClient();
  return clerk.waitlistEntries.list({ status: "pending", orderBy: "+created_at", limit: 25 });
}

export function accessQueueSnapshot(queue: Awaited<ReturnType<typeof pendingAccessQueue>>) {
  return {
    count: queue.totalCount,
    version: JSON.stringify([queue.totalCount, queue.data.map(entry => [entry.id, entry.updatedAt, entry.isLocked])]),
  };
}
