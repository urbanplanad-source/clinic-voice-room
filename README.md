# Clinic Voice Room

Clinic Voice Room is a hospital-focused realtime voice interpretation system.

The current repository contains the web MVP for staff login, room creation, guest join, realtime translation experiments, TTS playback, and usage tracking. The near-term field test target is the web version. Native app work remains a later option.

## Core Use Flow
1. Hospital staff logs in to the web app and starts an interpretation room.
2. The patient joins from a temporary QR web link with no account or installation.
3. Staff selects the patient language.
4. Consultation mode uses one-speaker-at-a-time push-to-talk.
5. Procedure mode uses two web devices: the doctor's phone and the patient-side phone.
6. A USB foot pedal or keyboard key can toggle the doctor's push-to-talk button in web procedure mode.
7. The other side sees translated text and can hear translated audio through the assigned phone speaker or earphone.
8. Staff/admin web screens remain available for usage review.

## Local Setup
```bash
pnpm install
cp .env.example .env
pnpm run prisma:migrate
pnpm run prisma:seed
pnpm run dev
```

## Operational Limits
- `HOSPITAL_ACTIVE_ROOM_LIMIT` controls how many non-ended rooms one hospital can have at the same time.
- `ROOM_AUTO_END_MINUTES` controls when old non-ended rooms are automatically marked ended.
- `CRON_SECRET` can protect `POST /api/rooms/cleanup-stale` if you later call it from a scheduled job.

Seed login:
- Email: `staff@clinic.test`
- Password: `password1234`

Admin seed login:
- Email: `admin@clinic.test`
- Password: `password1234`

## Docs
See the `docs/` folder for product, architecture, data model, business model, UX, and implementation planning. Android notes are kept for later app exploration in `docs/ANDROID_TRANSITION_ARCHITECTURE.md`, `docs/ANDROID_SPIKE_PLAN.md`, and `docs/ANDROID_2_DEVICE_SPIKE_RESULT.md`.
For field testing, use `docs/FIELD_TEST_GUIDE.md`.
For clinic-specific translation terms, use `docs/CLINIC_GLOSSARY_GUIDE.md`.

## App Spike
The Android prototype lives in `android-spike/` for later reference. The current field test path is web first.
