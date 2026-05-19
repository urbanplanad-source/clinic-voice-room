# PRODUCT_SPEC.md

> Status: current web field-test product spec. Android notes remain in separate documents for later native-device exploration.

Clinic Voice Room is a hospital-focused, QR-based interpretation system for Korean hospital staff and foreign patients. Consultation mode is text-first translated chat. Procedure mode remains voice-first for short in-room doctor prompts.

## Target Users
- Korean hospital staff: front desk staff, coordinators, consultation managers, foreign patient support staff
- Foreign patients: Chinese-speaking, Japanese-speaking, English-speaking, Russian-speaking, Vietnamese-speaking, Indonesian-speaking

## Core Value Proposition
- No patient installation or account.
- Galaxy Pad friendly language selection and waiting flow.
- Text-first consultation chat for higher translation accuracy.
- Staff-only text input in consultation mode, with patient examples and optional patient voice fallback.
- Voice-first procedure mode for short, repeatable in-room instructions.
- Hospital-level usage tracking without storing raw audio or full transcripts.

## Supported MVP Language Pairs
- Korean <-> Chinese
- Korean <-> Japanese
- Korean <-> English
- Korean <-> Russian
- Korean <-> Vietnamese
- Korean <-> Indonesian
- Korean <-> French
- Korean <-> Spanish
- Korean <-> German
- Korean <-> Italian
- Korean <-> Portuguese

## MVP Scope
- Staff login
- Hospital association
- Room creation
- QR code join
- Guest patient entry
- Consultation chat with translated message delivery
- Polling fallback for consultation chat delivery if realtime broadcast is missed
- Patient example-message categories and one-tap sending
- Staff follow-up suggestions by consultation stage and patient message
- Lightweight risk flags and consultation summary draft
- Procedure-mode push-to-talk mic interaction
- Procedure-mode translated audio playback where device/browser TTS is available
- Turn-taking state control
- Room end
- Usage tracking by hospital
- Minimal internal admin usage dashboard

## Non-Goals
- Full medical consultation record system
- EHR/EMR integration
- Human interpreter replacement positioning
- Permanent stored transcripts
- Voice recordings
- iOS app release
