# SnapCue — AI Interview Copilot

**Hear the question. Find your confidence.**

SnapCue helps you prepare for interviews using your CV and a job description. Practice with typed or recorded answers, review feedback, and build concise examples grounded in your experience.

[Open SnapCue](https://snap-cue.vercel.app/) · [Architecture](ARCHITECTURE.md) · [Deployment](DEPLOYMENT.md)

## Get started

1. Create an account and verify your email.
2. Open **Professional Profile** to upload your CV, add professional details, and set your profile photo.
3. Add a role and its description in **Job Intelligence** to review likely requirements and gaps.
4. Start a **Mock Interview** for guided practice, or open the **Answer Assistant** for structured talking points.
5. Review your progress in **Overview** and return to saved sessions in **Interview History**.

The studio opens in light mode for new users. Use the sun or moon button in the header to switch themes. SnapCue saves your choice. To update your password, open **Settings → Privacy and account → Change password**, then select **Security** in the Clerk account window.

## Workspace features

| Area | What you can do |
| --- | --- |
| Professional Profile | Manage your photo and CV versions. Upload PDF, DOCX or TXT up to 4 MB. Cloud uploads extract supported skills, work history, education, certifications, achievements, projects, and languages into your editable profile. |
| Job Intelligence | Compare CV evidence with job requirements and surface likely interview questions. |
| Mock Interview | Practice by text or recorded speech, receive feedback on individual answers, and save the session. |
| Answer Assistant | Stream concise, STAR-style or technical talking points using material from your workspace. |
| Live Assistant | Get real-time transcription and suggestions after confirming participant permission. |
| History and analytics | Review practice scores, communication trends, saved interviews, and any transcripts you chose to retain. |
| Settings | Manage appearance, speech language, microphones, notifications, retention, data export, and account deletion. |
| Owner dashboard | View service health and aggregate usage at `/admin` with the configured owner account. |

Live assistance requires the permission of everyone being recorded and must be allowed by the interview organizer. SnapCue does not retain raw audio. Saved live transcripts are opt-in. The app can be installed as a PWA and offers an offline fallback.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). With no cloud configuration, demo mode starts with sample results, simulated coaching and transcription, and browser-local persistence. Demo voice controls never request microphone access.

For a signed-in development environment, copy [`.env.example`](.env.example) to `.env.local`, configure a Clerk development application and a separate Convex development deployment, and set `NEXT_PUBLIC_SNAPCUE_MODE=cloud`. Store live credentials in the service dashboards or your ignored local environment file. See [Deployment](DEPLOYMENT.md) for the exact variables, Clerk JWT template, and Vercel build commands.

## How it works

- **Next.js and React** render the public landing page and authenticated studio. Studio tools load by section, and charts load when there is data to display.
- **Clerk** provides sign-up, sessions, password management, and account images. The production application uses a same-origin Clerk proxy on its Vercel domain.
- **Convex** stores workspace profiles, documents, practice history, settings, and owner-authorized aggregate usage. User-scoped queries and mutations check the authenticated identity.
- **OpenAI** powers coaching, embeddings, and recorded and live transcription. Cloud requests run server-side with per-account usage limits.

See [Architecture](ARCHITECTURE.md) for service boundaries, data handling, model choices, and operational limitations.

## Verify changes

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npx playwright test
```

On Windows with Microsoft Edge installed, set `PLAYWRIGHT_CHANNEL=msedge` to use Edge. The browser smoke suite uses the demo build. Backend integration tests use a simulated Convex backend and stubbed OpenAI responses. The [GitHub Actions workflow](.github/workflows/ci.yml) runs the repository checks.

## Deployment

Vercel hosts the web application and deploys Convex functions during the cloud build. Use separate development and production credentials. Preview deployments without a Convex deploy key run in demo mode. Production requires the matching Convex deploy key, Clerk credentials, and OpenAI access. Follow the [deployment runbook](DEPLOYMENT.md) to configure a release, verify sign-in, and grant owner access.
