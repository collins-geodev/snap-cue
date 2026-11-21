# SnapCue — AI Interview Copilot

**Hear the Question. Find Your Confidence.**

SnapCue helps candidates prepare with role-specific questions, voice and text practice, feedback, and answer suggestions grounded in their CV. Live transcription requires affirmative confirmation of participant and interview permission.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Demo mode runs without cloud credentials. It includes sample dashboard results, simulated coaching and transcription, text and TXT documents, and browser-local workspace persistence. Demo voice controls never request a microphone. Avoid entering sensitive information on a shared device.

Configure the existing Convex development deployment and Clerk to enable cloud mode. See [deployment instructions](DEPLOYMENT.md) and [.env.example](.env.example).

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npx playwright test
```

On a Windows system with Edge installed, set `PLAYWRIGHT_CHANNEL=msedge` to use that browser. The browser suite uses the production build in demo mode. Automated integration tests use a simulated Convex backend and stubbed OpenAI HTTP responses.

## Workspace

- Professional profile and multiple CV versions
- Job requirements, evidence gaps and likely questions
- Voice and text mock interviews with per-answer review
- Streaming answer assistant with concise, STAR and technical formats
- Permission-gated live transcript and suggestions
- Interview history, performance analytics, export and deletion
- Mobile install and an offline fallback

See [architecture](ARCHITECTURE.md) for data boundaries, model choices and operational limitations.
