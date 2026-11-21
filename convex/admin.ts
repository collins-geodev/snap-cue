import { v } from "convex/values";
import { query, type MutationCtx } from "./_generated/server";
import { isConfiguredOwner } from "./identity";

const metrics = ["interviews", "aiRequests", "transcriptionRequests", "liveSessions", "activeUserDays"] as const;
type Metric = typeof metrics[number];
type UsageMetric = Exclude<Metric, "activeUserDays">;

export async function recordUsage(ctx: MutationCtx, owner: string, metric: UsageMetric) {
  const day = new Date().toISOString().slice(0, 10);
  const record = await ctx.db.query("dailyAdminUsage").withIndex("by_day", q => q.eq("day", day)).unique();
  const marker = await ctx.db.query("adminUsageActivity").withIndex("by_owner", q => q.eq("owner", owner)).unique();
  const newDay = marker?.day !== day;
  if (newDay) {
    if (marker) await ctx.db.patch("adminUsageActivity", marker._id, { day });
    else await ctx.db.insert("adminUsageActivity", { owner, day });
  }
  if (record) {
    await ctx.db.patch("dailyAdminUsage", record._id, {
      [metric]: record[metric] + 1,
      activeUserDays: record.activeUserDays + Number(newDay),
    });
  } else {
    await ctx.db.insert("dailyAdminUsage", {
      day, interviews: Number(metric === "interviews"), aiRequests: Number(metric === "aiRequests"),
      transcriptionRequests: Number(metric === "transcriptionRequests"), liveSessions: Number(metric === "liveSessions"),
      activeUserDays: 1,
    });
  }
}

export const overview = query({
  args: {},
  returns: v.union(v.null(), v.object({
    interviews: v.number(), aiRequests: v.number(), transcriptionRequests: v.number(), liveSessions: v.number(),
    activeUserDays: v.number(), activeToday: v.number(),
  })),
  handler: async ctx => {
    if (!isConfiguredOwner(await ctx.auth.getUserIdentity())) return null;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    now.setUTCDate(now.getUTCDate() - 6);
    const days = await ctx.db.query("dailyAdminUsage")
      .withIndex("by_day", q => q.gte("day", now.toISOString().slice(0, 10)).lte("day", today))
      .take(7);
    const totals = { interviews: 0, aiRequests: 0, transcriptionRequests: 0, liveSessions: 0, activeUserDays: 0 };
    for (const day of days) {
      for (const metric of metrics) totals[metric] += day[metric];
    }
    return { ...totals, activeToday: days.find(day => day.day === today)?.activeUserDays ?? 0 };
  },
});
