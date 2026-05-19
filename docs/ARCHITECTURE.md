# ARCHITECTURE.md

## Architecture Goal
Build a hospital-focused interpretation system that can run the current web field-test workflow first while keeping the Android spike documents available for later native-device hardening.

The current product split is deliberate: consultation mode is a lightweight text-first translated chat for accuracy and tablet usability, while procedure mode keeps a voice-first flow for short doctor prompts in the treatment room.

## Stack
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Next.js Route Handlers
- PostgreSQL
- Prisma ORM
- Supabase Postgres and lightweight Realtime/control events
- OpenAI Realtime API with server-issued ephemeral credentials
- Android / Kotlin, LiveKit/SFU, or other native audio routing remain later options for procedure-mode hardening

## Current MVP Implementation Note
The app currently uses lightweight browser polling for room state updates so it can run without a separate realtime infrastructure during first setup. The room state service and API boundaries are intentionally isolated so Supabase Realtime or a WebSocket transport can replace polling without changing the product flow.

Consultation mode is text-first and uses `POST /api/translate-text`, backed by the OpenAI Responses API with `gpt-5.5` by default for accuracy-oriented medical consultation translation. Staff consultation input is text-only. Patient consultation input shows text first. The UI adds staged consultation guidance, patient sample-message categories, staff follow-up suggestions, lightweight risk flags, and a summary draft.

OpenAI Realtime credential issuance keeps the permanent API key server-side. The current procedure translation path uses `POST /v1/realtime/translations/client_secrets` and `POST /v1/realtime/translations/calls` for browser WebRTC translation, then uses device/browser TTS on the receiving device when speech playback is enabled. Full production audio relay between two Android devices is now the main integration hardening step.

See [ANDROID_TRANSITION_ARCHITECTURE.md](ANDROID_TRANSITION_ARCHITECTURE.md) for the earlier Android target architecture notes.

## Room Control Logic
Procedure mode keeps one-speaker-at-a-time room control. Microphones are disabled when the other person is speaking, while translation is pending, and while translated audio is playing. Playback end returns the room to `ready`.

Consultation mode is chat-based. Messages are optimistically shown on the sender side with sending/failed status, translated through the server, and delivered to the other participant through Supabase Realtime with polling as a fallback.

## API Surface
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/rooms`
- `GET /api/rooms/:roomId`
- `GET /api/rooms/by-token/:roomToken`
- `POST /api/rooms/:roomId/join-patient`
- `POST /api/rooms/:roomId/state`
- `POST /api/rooms/:roomId/end`
- `POST /api/translate-text`
- `POST /api/realtime/session-token`
- `POST /api/usage/speaking-event`
- `GET /api/admin/usage`

## Data Retention
Store room metadata, usage metadata, and plan metadata. Do not store raw audio, full transcripts, or patient PII.
