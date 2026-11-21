import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const stage = process.env.VERCEL_ENV;
const url = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\/$/, "");
const productionUrl = "https://adventurous-ferret-881.convex.cloud";
const developmentUrl = "https://agreeable-mule-700.convex.cloud";

if (!url || (stage === "production" && url !== productionUrl) || (stage === "preview" && [productionUrl, developmentUrl].includes(url))) {
  console.error("Convex deployment URL does not match the Vercel environment.");
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY || !process.env.OPENAI_API_KEY) {
  console.error("Set the Clerk and OpenAI server environment for this Vercel target.");
  process.exit(1);
}
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build", "--webpack"], { stdio: "inherit" });
process.exit(result.status ?? 1);
