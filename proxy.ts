import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
const protectedRoute = createRouteMatcher(["/studio(.*)", "/api/(.*)"]);
const authenticate = clerkMiddleware(async (auth, request) => {
  if (protectedRoute(request)) await auth.protect({ unauthenticatedUrl: new URL("/sign-in", request.url).toString() });
});
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  return process.env.NEXT_PUBLIC_SNAPCUE_MODE === "cloud" ? authenticate(request, event) : NextResponse.next();
}
export const config = { matcher: ["/((?!_next|.*\\.[\\w]+$).*)", "/api/(.*)"] };
