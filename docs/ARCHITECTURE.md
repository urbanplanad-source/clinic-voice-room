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

Consultation mode is chat-based and uses `POST /api/translate-text` for text fallback, backed by the OpenAI Responses API with `gpt-5.2` by default unless `OPENAI_TEXT_TRANSLATION_MODEL` overrides it. Staff Android voice uses Realtime-first manual turns with bounded upload fallback. Patient web voice still uses short bounded uploads.

OpenAI Realtime credential issuance keeps the permanent API key server-side. Current code issues ephemeral credentials through `POST /v1/realtime/client_secrets`; browser WebRTC uses `POST /v1/realtime/calls` with manual push-to-talk commit events, and Android staff voice uses a Realtime WebSocket connection with manual input-audio commit. The older `realtime/translations/*` endpoint notes remain only in historical spike docs.

See [ANDROID_TRANSITION_ARCHITECTURE.md](ANDROID_TRANSITION_ARCHITECTURE.md) for the earlier Android target architecture notes.

## Room Control Logic
Procedure mode keeps one-speaker-at-a-time room control. Microphones are disabled when the other person is speaking, while translation is pending, and while translated audio is playing. Playback end returns the room to `ready`.

Consultation mode is chat-based. Messages are optimistically shown on the sender side with sending/failed status, translated through the server, and delivered to the other participant through Supabase Realtime with polling as a fallback.
For reliability, translated consultation chat snippets are kept as room-scoped live messages and removed when the room ends or is marked stale. Raw audio, source voice, and permanent full transcripts remain out of scope.

Room mode is stored on `TranslationRoom.roomMode` and is the source of truth after room creation. `POST /api/translate-text` only accepts consultation rooms, while procedure audio endpoints only accept procedure rooms.

Inactive rooms are closed by `GET /api/rooms/cleanup-stale`, protected with `CRON_SECRET` and scheduled in `vercel.json` for every 5 minutes. The cleanup uses `TranslationRoom.lastActiveAt`, not the creation time, so active conversations are not ended just because the room is older than the timeout.

## API Surface
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/rooms`
- `GET /api/rooms/:roomId`
- `GET /api/rooms/by-token/:roomToken` (legacy compatibility; disabled in production unless `ALLOW_LEGACY_ROOM_TOKEN_LOOKUP=true`)
- `GET /api/rooms/:roomId/patient`
- `POST /api/rooms/:roomId/join-patient`
- `POST /api/rooms/:roomId/state`
- `POST /api/rooms/:roomId/end`
- `GET /api/rooms/:roomId/messages`
- `POST /api/rooms/:roomId/messages/read`
- `POST /api/translate-text`
- `POST /api/realtime/session-token`
- `POST /api/usage/speaking-event`
- `GET /api/admin/usage`

## Data Retention
Store room metadata, usage metadata, and plan metadata. Do not store raw audio, full transcripts, or patient PII.
Consultation chat live-delivery rows are temporary room data and are deleted on room termination/stale cleanup.
