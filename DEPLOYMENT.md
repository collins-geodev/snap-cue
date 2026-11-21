# Deployment

| Environment | Convex |
| --- | --- |
| Local cloud development | `https://agreeable-mule-700.convex.cloud` |
| Vercel production | `https://adventurous-ferret-881.convex.cloud` |
| Vercel previews | Isolated Convex preview deployment with a preview key, or an isolated demo build |

## Existing Convex development deployment

1. Check the Convex dashboard to confirm ownership and compare the development and production deployment names under the same project. Reuse the existing project.
2. Create a Clerk JWT template named `convex`. Use a development Clerk application for local development and set its issuer as `CLERK_JWT_ISSUER_DOMAIN` in the supplied development deployment. Set `OPENAI_API_KEY` in the same Convex environment.
3. Copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_SNAPCUE_MODE=cloud`, and supply the Clerk development keys and server-side OpenAI key. Use `CONVEX_DEPLOYMENT=dev:agreeable-mule-700` and the development URL.
4. Inspect the existing development deployment before applying the app’s schema. Once credentials and settings are ready, use `npx convex dev --once`, followed by `npm run dev`.

## Vercel

Reuse or create `snap-cue` in `polosoftcollins-8070s-projects` and connect `collins-geodev/snap-cue`. Use the Next.js preset and set the build override to `node scripts/vercel-build.mjs`. The script invokes Convex’s Vercel CLI build with a deploy key scoped to the appropriate environment. It validates the returned Convex URL before building the frontend. Preview without a key builds the demo, with no Convex connection. Set preview Clerk and OpenAI values separately if enabling cloud previews.

Before triggering the production deploy, get explicit approval, check the existing production schema for compatibility, and confirm domain and Clerk production settings. Set the production values through secured Vercel and Convex settings.

| Variable | Location |
| --- | --- |
| `CONVEX_DEPLOY_KEY` | Vercel production deploy key for `adventurous-ferret-881`. Preview uses only a separate project preview key. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Vercel, scoped by environment |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex for each cloud deployment |
| `OPENAI_API_KEY` | Convex and Vercel, scoped by environment |

A preview key can create an isolated preview backend. Configure auth and OpenAI for that backend before running a cloud smoke test. Use a verified domain that Clerk accepts for production. Never paste secrets into GitHub files or commit `.env.local`.

After deploying, verify the production URL, HTTPS, account recovery and sign-in, deployment isolation, native audio behavior, and the signed-in AI workflows. Promote or release only after those checks pass.

[Convex on Vercel](https://docs.convex.dev/production/hosting/vercel) · [Clerk and Convex](https://docs.convex.dev/auth/clerk) · [OpenAI speech models](https://developers.openai.com/api/docs/guides/transcription)

## Owner dashboard

The production dashboard is available at `/admin`. After the designated owner signs up and verifies their email in Clerk, copy that user’s ID and save it as `SNAPCUE_OWNER_SUBJECT` in production Convex. The server checks the authenticated Clerk subject on each aggregate query. Configure the owner account with MFA. The dashboard shows only aggregate usage, coarse service checks, and the Clerk account count.
