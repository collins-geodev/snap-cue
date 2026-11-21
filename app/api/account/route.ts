import { clerkClient } from "@clerk/nextjs/server";
import { authenticatedClient, sameOrigin } from "@/lib/server-auth";
import { api } from "@/convex/_generated/api";
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const secured = await authenticatedClient();
  if (!secured) return new Response(null, { status: 401 });
  await secured.client.mutation(api.store.erase, {});
  await (await clerkClient()).users.deleteUser(secured.userId);
  return new Response(null, { status: 204 });
}
