import type { UserIdentity } from "convex/server";

export async function identityOf(ctx: { auth: { getUserIdentity(): Promise<UserIdentity | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in to continue.");
  return identity;
}

export async function ownerOf(ctx: Parameters<typeof identityOf>[0]) {
  return (await identityOf(ctx)).tokenIdentifier;
}

export function isConfiguredOwner(identity: UserIdentity | null) {
  const subject = process.env.SNAPCUE_OWNER_SUBJECT;
  return Boolean(subject && identity?.subject === subject);
}
