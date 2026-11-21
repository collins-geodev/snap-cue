import { api } from "@/convex/_generated/api";
import { accessQueueSnapshot, pendingAccessQueue } from "@/lib/access-queue";
import { authenticatedClient } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await authenticatedClient();
  if (!session) return Response.json({ error: "Sign-in required." }, { status: 401, headers });
  try {
    if (!(await session.client.query(api.admin.overview, {}))) {
      return Response.json({ error: "Owner access required." }, { status: 403, headers });
    }
    return Response.json(accessQueueSnapshot(await pendingAccessQueue()), { headers });
  } catch {
    return Response.json({ error: "The access queue is temporarily unavailable." }, { status: 503, headers });
  }
}
