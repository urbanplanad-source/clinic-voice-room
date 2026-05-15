# AGENTS.md

## Project Name
Clinic Voice Room

## Project Mission
Build a hospital-focused, QR-based real-time voice interpretation web application for Korean hospital staff and foreign patients speaking Chinese, Japanese, or English.

The app is voice-first, QR-based, requires no patient installation, and uses one-speaker-at-a-time turn taking in the MVP.

## MVP Scope Priority
1. Staff authentication
2. Hospital/account structure
3. Translation room creation
4. QR code join flow
5. Patient guest entry flow
6. Push-to-talk microphone UX
7. Two-way translated audio playback
8. Room state synchronization
9. Room termination
10. Hospital-level usage tracking
11. Minimal admin dashboard for usage review

## Non-Goals For MVP
- Earphone integration
- Native mobile apps
- Full transcript storage
- Recording storage
- CRM integrations
- n8n automations
- Consultation summarization
- Payment integration
- Multi-person rooms beyond one staff and one patient

## Preferred Technical Direction
- Frontend: Next.js / React / TypeScript
- Styling: Tailwind CSS
- Backend: Next.js Route Handlers
- Database: PostgreSQL with Prisma
- Auth: staff-only authentication
- Realtime room state: Supabase Realtime or equivalent
- Voice translation: OpenAI Realtime via server-issued ephemeral credentials
- QR Code: client-side generation library

## Security Principles
- Never expose permanent API keys to the browser.
- Patients should not need accounts.
- Patient links must be temporary and room-specific.
- Store only essential metadata in MVP.
- Do not store raw voice audio or full consultation transcripts.
