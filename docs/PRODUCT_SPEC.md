# PRODUCT_SPEC.md

> Status: this document describes the original web MVP. The current product direction is Android-first hospital-provisioned two-device interpretation. See [ANDROID_TRANSITION_ARCHITECTURE.md](ANDROID_TRANSITION_ARCHITECTURE.md).

Clinic Voice Room is a hospital-focused real-time voice interpretation system that allows Korean hospital staff and foreign patients to speak naturally without typing.

## Target Users
- Korean hospital staff: front desk staff, coordinators, consultation managers, foreign patient support staff
- Foreign patients: Chinese-speaking, Japanese-speaking, English-speaking, Russian-speaking, Vietnamese-speaking, Indonesian-speaking

## Core Value Proposition
- No typing
- Hospital-provisioned Android devices for controlled setup
- No need to pass one phone back and forth
- Optional QR-based instant room entry for web or fallback flows
- Spoken translation output
- Better in-clinic foreign patient communication

## Supported MVP Language Pairs
- Korean <-> Chinese
- Korean <-> Japanese
- Korean <-> English
- Korean <-> Russian
- Korean <-> Vietnamese
- Korean <-> Indonesian

## MVP Scope
- Staff login
- Hospital association
- Room creation
- QR code join
- Guest patient entry
- Push-to-talk mic interaction
- Two-way translated audio playback
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
