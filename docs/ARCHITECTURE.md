# ARCHITECTURE.md

## Architecture Goal
Build a hospital-focused interpretation system that can keep the current web MVP for staff/admin workflows while moving the core realtime treatment-room audio experience to hospital-provisioned Android devices.

The original web architecture remains useful as a control plane and proof-of-flow. The product direction is now Android-first for doctor/patient audio because the default deployment uses two hospital-provided Android phones rather than patient personal devices.

## Stack
- Android / Kotlin for the target realtime interpretation clients
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Next.js Route Handlers
- PostgreSQL
- Prisma ORM
- Supabase Postgres and lightweight Realtime/control events
- LiveKit/SFU candidate for production realtime audio routing
- OpenAI Realtime API with server-issued ephemeral credentials

## Current MVP Implementation Note
The app currently uses lightweight browser polling for room state updates so it can run without a separate realtime infrastructure during first setup. The room state service and API boundaries are intentionally isolated so Supabase Realtime or a WebSocket transport can replace polling without changing the product flow.

Consultation mode is text-first and uses `POST /api/translate-text`, backed by the OpenAI Responses API with `gpt-5.5` by default for accuracy-oriented medical consultation translation. Staff consultation input is text-only. Patient consultation input shows text first and leaves voice as a fallback.

OpenAI Realtime credential issuance keeps the permanent API key server-side. The current procedure translation path uses `POST /v1/realtime/translations/client_secrets` and `POST /v1/realtime/translations/calls` for browser WebRTC translation, then uses device/browser TTS on the receiving device when speech playback is enabled. Full production audio relay between two Android devices is now the main integration hardening step.

See [ANDROID_TRANSITION_ARCHITECTURE.md](ANDROID_TRANSITION_ARCHITECTURE.md) for the Android-first target architecture.

## Room Control Logic
Only one speaker may be active at a time. Microphones are disabled when the other person is speaking, while translation is pending, and while translated audio is playing. Playback end returns the room to `ready`.

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
