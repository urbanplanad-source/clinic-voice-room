# IMPLEMENTATION_PLAN.md

This repository implements the original Clinic Voice Room web MVP plan accepted by the user.

> Current direction: Android-first hospital-provisioned two-device interpretation. Keep this plan as the web MVP implementation record. Use [ANDROID_TRANSITION_ARCHITECTURE.md](ANDROID_TRANSITION_ARCHITECTURE.md) for the next product architecture.

## Summary
- Next.js App Router, React, TypeScript, Tailwind CSS
- Prisma data model for hospitals, staff, rooms, participants, and usage
- Staff-only auth with temporary signed cookies
- QR-based patient guest entry for the web MVP
- Server-authoritative turn-taking room state
- OpenAI Realtime session-token route with permanent API key kept server-side
- Usage tracking and minimal admin dashboard

## Milestones
1. Bootstrap and docs
2. Database, auth, and hospital structure
3. Staff home, language selection, and room creation
4. Patient guest join
5. Realtime room state synchronization
6. OpenAI Realtime session token issuance
7. Push-to-talk voice translation and playback
8. Room termination and usage tracking
9. Admin usage dashboard
10. Hardening and pilot readiness

## Important Defaults
- Patient guest links are temporary and room-specific.
- No raw audio or full transcript storage.
- Tap-to-start/tap-to-stop is the initial push-to-talk model.
- The current implementation uses lightweight polling for room state so the MVP can run anywhere; it is structured so Supabase Realtime or WebSocket transport can replace the polling hook later.
- The current voice UI validates microphone access, turn-taking, usage events, and secure Realtime client-secret issuance. Production-grade opposite-device translated audio relay is the highest-priority follow-up integration step once OpenAI credentials are configured.
