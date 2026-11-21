import assert from "node:assert/strict";
import { test } from "node:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { defaultProfile, demoAssessment, type Setup } from "../lib/domain";

const modules = {
  "./_generated/server.ts": () => import("../convex/_generated/server"),
  "./admin.ts": () => import("../convex/admin"),
  "./store.ts": () => import("../convex/store"),
  "./intelligence.ts": () => import("../convex/intelligence"),
};
const setup: Setup = { category: "Technical", difficulty: "Intermediate", role: "Engineer", organization: "", count: 2, minutes: 10 };
const turn = { question: "How did you test it?", answer: "I validated the output against a reference dataset.", assessment: demoAssessment("Validated results") };

test("Convex rejects anonymous requests and isolates user workspaces", async () => {
  const backend = convexTest(schema, modules);
  const alice = backend.withIdentity({ subject: "alice", tokenIdentifier: "test|alice" });
  const bob = backend.withIdentity({ subject: "bob", tokenIdentifier: "test|bob" });
  await assert.rejects(backend.query(api.store.workspace, {}), /Sign in/);
  const session = await alice.mutation(api.store.saveSession, { setup, turns: [turn] });
  await alice.mutation(api.store.saveProfile, { value: { ...defaultProfile, summary: "Alice’s profile" } });
  assert.equal((await alice.query(api.store.workspace, {})).profile?.summary, "Alice’s profile");
  assert.equal((await bob.query(api.store.workspace, {})).sessions.length, 0);
  await assert.rejects(bob.mutation(api.store.removeSession, { id: session }), /unavailable/);
  await assert.rejects(bob.mutation(api.store.saveSession, { setup, turns: [turn], id: session }), /unavailable/);
  await alice.mutation(api.store.erase, {});
  assert.equal((await alice.query(api.store.workspace, {})).sessions.length, 0);
});
test("retention requires consent and live quota enforces its hourly limit", async () => {
  const backend = convexTest(schema, modules);
  const user = backend.withIdentity({ subject: "alice", tokenIdentifier: "test|alice" });
  await assert.rejects(user.mutation(api.store.retainLive, { text: "Example" }), /retention/);
  await user.mutation(api.store.consent, { retain: true });
  await user.mutation(api.store.retainLive, { text: "Example" });
  assert.equal((await user.query(api.store.transcripts, {})).length, 1);
  for (let attempt = 0; attempt < 8; attempt++) await user.mutation(api.store.quota, { kind: "live" });
  await assert.rejects(user.mutation(api.store.quota, { kind: "live" }), /usage limit/);
});

test("ingested CV passages are retrieved only for their owner", async t => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-secret";
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
  const vector = [1, ...Array<number>(1535).fill(0)];
  const originalFetch = globalThis.fetch;
  const fetchMock = t.mock.fn(async (url: string, request: RequestInit) => {
    assert.match(url, /\/embeddings$/);
    const { input } = JSON.parse(String(request.body)) as { input: string[] };
    return Response.json({ data: input.map((_, index) => ({ index, embedding: vector })) });
  });
  globalThis.fetch = fetchMock as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const backend = convexTest(schema, modules);
  const alice = backend.withIdentity({ subject: "alice", tokenIdentifier: "test|alice" });
  const bob = backend.withIdentity({ subject: "bob", tokenIdentifier: "test|bob" });
  const { id } = await alice.action(api.intelligence.ingest, { kind: "resume", title: "GIS CV", text: "I designed a geospatial quality assurance process." });
  const result = await alice.action(api.intelligence.answerContext, { question: "How do you ensure data quality?", resume: id });
  assert.match(result.sources[0].label, /GIS CV/);
  assert.match(result.sources[0].text, /geospatial quality/);
  const calls = fetchMock.mock.callCount();
  await assert.rejects(bob.action(api.intelligence.answerContext, { question: "Show another CV", resume: id }), /unavailable/);
  assert.equal(fetchMock.mock.callCount(), calls);
  await assert.rejects(bob.mutation(api.store.removeDocument, { id }), /unavailable/);
  await alice.mutation(api.store.removeDocument, { id });
  const afterDelete = await alice.action(api.intelligence.answerContext, { question: "How do you ensure data quality?" });
  assert.deepEqual(afterDelete.sources, []);
});

test("only the configured Clerk subject can read aggregate operations data", async t => {
  const original = process.env.SNAPCUE_OWNER_SUBJECT;
  t.after(() => {
    if (original === undefined) delete process.env.SNAPCUE_OWNER_SUBJECT;
    else process.env.SNAPCUE_OWNER_SUBJECT = original;
  });
  const backend = convexTest(schema, modules);
  const member = backend.withIdentity({ subject: "member", tokenIdentifier: "test|member" });
  const owner = backend.withIdentity({ subject: "owner", tokenIdentifier: "test|owner" });
  delete process.env.SNAPCUE_OWNER_SUBJECT;
  assert.equal(await owner.query(api.admin.overview, {}), null);
  process.env.SNAPCUE_OWNER_SUBJECT = "owner";
  assert.equal(await backend.query(api.admin.overview, {}), null);
  assert.equal(await member.query(api.admin.overview, {}), null);
  await member.mutation(api.store.quota, { kind: "ai" });
  await member.mutation(api.store.quota, { kind: "speech" });
  const interview = await member.mutation(api.store.saveSession, { setup, turns: [turn] });
  await member.mutation(api.store.saveSession, { setup, turns: [turn], id: interview });
  assert.deepEqual(await owner.query(api.admin.overview, {}), {
    interviews: 1, aiRequests: 1, transcriptionRequests: 1, liveSessions: 0, activeUserDays: 1, activeToday: 1,
  });
});

test("theme toggling persists the choice without replacing other preferences", async () => {
  const backend = convexTest(schema, modules);
  const member = backend.withIdentity({ subject: "member", tokenIdentifier: "test|member" });
  await assert.rejects(backend.mutation(api.store.setTheme, { theme: "light" }), /Sign in/);
  await member.mutation(api.store.setTheme, { theme: "light" });
  const initial = (await member.query(api.store.workspace, {})).settings;
  assert.equal(initial?.theme, "light");
  if (!initial) throw new Error("Missing preferences");
  await member.mutation(api.store.saveSettings, { value: { ...initial, language: "fr" } });
  await member.mutation(api.store.setTheme, { theme: "dark" });
  assert.deepEqual((await member.query(api.store.workspace, {})).settings, { ...initial, language: "fr", theme: "dark" });
});
