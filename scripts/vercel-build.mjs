import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const stage = process.env.VERCEL_ENV;
const key = process.env.CONVEX_DEPLOY_KEY ?? "";
const production = stage === "production";
const preview = stage === "preview";

if (!production && !preview) {
  console.error("Use npm run build for local builds.");
  process.exit(1);
}
if (production && !key.startsWith("prod:adventurous-ferret-881|")) {
  console.error("Production requires the deployment key for adventurous-ferret-881.");
  process.exit(1);
}
if (preview && key && !/^preview:[^:|]+:[^:|]+\|/.test(key)) {
  console.error("Preview only accepts a Convex preview deploy key.");
  process.exit(1);
}

const env = { ...process.env, NEXT_PUBLIC_SNAPCUE_MODE: key ? "cloud" : "demo" };
delete env.NEXT_PUBLIC_CONVEX_URL;
const next = require.resolve("next/dist/bin/next");
const convex = join(dirname(require.resolve("convex/package.json")), "bin/main.js");
const cloudVariables = ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"];
const missing = cloudVariables.filter(name => !env[name]?.trim());
if (key && missing.length) {
  console.error(`Missing Vercel ${stage} environment variables: ${missing.join(", ")}`);
  process.exit(1);
}
if (production) {
  const check = spawnSync(process.execPath, [convex, "env", "list", "--names-only"], { env, encoding: "utf8" });
  const names = check.stdout?.trim().split(/\s+/);
  if (check.status !== 0 || !names?.includes("CLERK_JWT_ISSUER_DOMAIN") ||
      !(names.includes("GEMINI_API_KEY") || names.includes("OPENAI_API_KEY"))) {
    console.error("Configure the Clerk issuer and an AI provider on production Convex before deploying.");
    process.exit(1);
  }
}
const command = key ? [convex, "deploy", "--cmd-url-env-var-name", "NEXT_PUBLIC_CONVEX_URL", "--cmd", "node scripts/validate-cloud-build.mjs"] : [next, "build", "--webpack"];
const result = spawnSync(process.execPath, command, { env, stdio: "inherit" });
process.exit(result.status ?? 1);
