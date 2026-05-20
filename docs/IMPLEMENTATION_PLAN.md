# IMPLEMENTATION_PLAN.md

This repository implements the Clinic Voice Room web field-test product.

> Current direction: web-first pilot. Consultation mode is text-first translated chat. Procedure mode uses the hospital phone as the in-room audio hub for short push-to-talk turns. Android documents remain as later architecture notes.

## Summary
- Next.js App Router, React, TypeScript, Tailwind CSS
- Prisma data model for hospitals, staff, rooms, participants, and usage
- Staff-only auth with temporary signed cookies
- QR-based patient guest entry for the web MVP
- Server-authoritative turn-taking room state
- OpenAI Realtime session-token route and procedure-turn upload route with permanent API key kept server-side
- Usage tracking and minimal admin dashboard
- Text-first consultation room with patient examples, staff suggestions, risk chips, and summary draft

## Milestones
1. Bootstrap and docs
2. Database, auth, and hospital structure
3. Staff home, language selection, and room creation
4. Patient guest join
5. Realtime room state synchronization
6. OpenAI Realtime session token issuance
7. Consultation chat translation and hospital-phone-centered procedure push-to-talk voice translation
8. Room termination and usage tracking
9. Admin usage dashboard
10. Hardening and pilot readiness

## Important Defaults
- Patient guest links are temporary and room-specific.
- No raw audio or full transcript storage.
- Consultation mode is chat-based and does not use the old voice-first room UI.
- Tap-to-start/tap-to-stop is the procedure-mode push-to-talk model, including footpad keyboard input on the hospital phone.
- In procedure mode, the hospital phone owns audio output. Staff speech is translated and read aloud on the hospital phone through browser/device TTS, while the patient/secondary QR device receives translated text only.
- Patient speech in procedure mode is captured as a short recording turn on the QR device, uploaded to `/api/procedure-turns`, translated to Korean, and then read aloud on the hospital phone.
- The current implementation uses lightweight polling for room state so the MVP can run anywhere; it is structured so Supabase Realtime or WebSocket transport can replace the polling hook later.
- The current voice UI validates microphone access, turn-taking, usage events, secure Realtime client-secret issuance, and no-storage procedure audio upload. Production-grade low-latency streaming relay remains a later hardening option if short-turn upload latency is not sufficient.
