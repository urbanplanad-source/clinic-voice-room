# Clinic Voice Room

Clinic Voice Room is a hospital-focused realtime voice interpretation system.

The current repository contains the web MVP for staff login, room creation, guest join, text-first consultation translation, realtime procedure translation experiments, device TTS playback, and usage tracking. The near-term field test target is the web version. Native app work remains a later option.

## Core Use Flow
1. Hospital staff logs in and chooses either a consultation room or procedure room.
2. The Galaxy Pad can stay open on the patient-facing language selection screen.
3. The patient chooses their language and confirms.
4. The app creates the room and shows the QR join screen.
5. Consultation mode is text-first: staff uses text only, while patients see text input first and can optionally use voice.
6. Procedure mode uses two web devices: the doctor's phone and the patient-side phone.
7. A USB foot pedal or keyboard key can toggle the doctor's push-to-talk button in web procedure mode.
8. The other side sees translated text and can hear translated audio through the assigned phone speaker or earphone in procedure mode.

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

## Production Staff Accounts
Production staff accounts are stored in the `StaffUser` table, not in Supabase Auth.
Create one account per employee so room ownership and usage tracking remain clear.

Example for Bellemon:
```bash
pnpm staff:create -- --hospital-slug bellemon --hospital-name "벨르몬성형외과" --name "상담실장" --email "bellemon01@clinic.local"
```

If `--password` or `STAFF_PASSWORD` is not provided, the script prints one generated temporary password.
Do not use public test credentials in a real hospital deployment.
Create one real `internal_admin` account first, then use `/admin/staff` in the web app to add or update hospital staff accounts.

The Prisma seed script no longer creates public test accounts by default. For local development only, set
`SEED_STAFF_PASSWORD` and optional `SEED_*` values before running `pnpm prisma:seed`.

## Docs
See the `docs/` folder for product, architecture, data model, business model, UX, and implementation planning. Android notes are kept for later app exploration in `docs/ANDROID_TRANSITION_ARCHITECTURE.md`, `docs/ANDROID_SPIKE_PLAN.md`, and `docs/ANDROID_2_DEVICE_SPIKE_RESULT.md`.
For field testing, use `docs/FIELD_TEST_GUIDE.md`.
For clinic-specific translation terms, use `docs/CLINIC_GLOSSARY_GUIDE.md`.

## App Spike
The Android prototype lives in `android-spike/` for later reference. The current field test path is web first.
