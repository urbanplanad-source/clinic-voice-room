# Clinic Voice Room

Clinic Voice Room is a hospital-focused realtime voice interpretation system.

The current repository contains the web MVP for staff login, procedure room creation, QR guest join, installable face-to-face procedure translation, staff text translation, device TTS playback, and usage tracking. The near-term field test target is the web version. Native app work remains a later option.

## Core Use Flow
1. Hospital staff logs in and chooses procedure QR translation, installable face-to-face translation, or staff text translation.
2. Procedure QR translation creates a procedure room and shows the QR join screen for the customer device.
3. Installable face-to-face translation creates a procedure room, auto-joins the customer side in the same browser, and shows staff/customer panels side by side.
4. The staff hardware button should emit PageUp; the customer hardware button should emit PageDown. For PC testing, staff can also use F8 or mouse middle/back inside the staff panel, and the customer side can use F9 or mouse right/forward inside the customer panel.
5. A USB foot pedal or keyboard key can toggle push-to-talk in web procedure mode.
6. The other side sees translated text and can hear translated audio through the assigned PC/device speaker in procedure mode.

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
- `ROOM_AUTO_END_MINUTES` controls how many inactive minutes are allowed before a non-ended room is automatically marked ended. The default is 5 minutes.
- `CRON_SECRET` protects `GET/POST /api/rooms/cleanup-stale`. Vercel Cron calls the GET endpoint every 5 minutes in production.

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
