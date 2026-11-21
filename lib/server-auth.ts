import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

export async function authenticatedClient() {
  if (process.env.NEXT_PUBLIC_SNAPCUE_MODE !== "cloud") return null;
  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "convex" }) : null;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!token || !url) return null;
  const client = new ConvexHttpClient(url);
  client.setAuth(token);
  return { client, userId: userId! };
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
