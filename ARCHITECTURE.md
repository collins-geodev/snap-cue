# Architecture

Next.js serves the public site, Clerk authentication and the responsive studio. Convex subscriptions supply the signed-in workspace. Next.js server routes forward the user’s Clerk JWT to Convex for authorization and handle file extraction, recorded transcription, realtime credentials, and streaming answer suggestions.

## Data model and authorization

Convex uses Clerk’s issuer-scoped token identifier as the owner key. Public functions derive ownership from authenticated requests. Internal functions perform document and embedding writes and source hydration. The indexed tables hold profile fields, settings, document versions, knowledge chunks, saved interviews, transcript opt-ins, retained transcripts, and rolling hourly quotas. Interview questions, responses and assessments are bounded within session records. Profile skills, experience and projects are editable fields within the profile record.

Storage-backed uploads retain the original file and extracted text. Deletion removes the document, associated chunks and stored original. Workspaces are bounded to 30 source documents, 100 practice sessions and 30 retained transcripts. The account export contains user-visible workspace data in JSON.

## AI and speech

Uploads accept text, PDF with an extractable text layer, DOCX and plain UTF-8 TXT. Size and format checks precede parsing. Chunks overlap and use 1,536-dimensional `text-embedding-3-small` vectors. Retrieval checks selected document ownership and verifies returned source records before including excerpts. Prompts treat documents and user text as untrusted input and distinguish user-provided material from general guidance. Scores are coaching estimates. Source labels point to supplied material and do not independently verify a candidate’s claims.

Recorded voice uses `gpt-transcribe`. Live uses `gpt-live-transcribe` over WebRTC with a short-lived client secret. The browser commits an audio turn after detecting a pause or a manual signal. Question detection currently uses English phrasing and punctuation heuristics. Capture requires two explicit permission confirmations and a user action. Capture pauses when muted and closes on navigation, backgrounding or a connection failure. SnapCue does not retain raw audio. Live transcript retention defaults off and requires a separate save action.

## Offline behavior

The service worker caches the static offline page only. It does not cache workspace responses or API data. Cloud transcription and coaching need connectivity and supported browsers.

## Coverage and release validation

The demo suite covers mobile layout, simulated live controls, document upload, job analysis, practice completion and history. Before production, verify Clerk sign-up, sign-in, recovery and access isolation against development, real document formats, OpenAI generation and models, and HTTPS microphone permission, interruptions and screen locking on a physical iOS and Android device. Assess latency on representative networks.
