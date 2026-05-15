# Clinic Voice Room

Clinic Voice Room is a hospital-focused realtime voice interpretation system.

The current repository contains the web MVP for staff login, room creation, guest join, realtime translation experiments, TTS playback, and usage tracking. Product direction has shifted to a hospital-provisioned Android two-device model for the core doctor/patient audio experience.

## Core Use Flow
1. Hospital staff or a configured device starts an interpretation room.
2. The doctor Android phone and patient Android phone pair to the same room.
3. Staff selects the patient language.
4. Consultation mode uses push-to-talk or semi-automatic turn taking.
5. Procedure mode keeps doctor interaction minimal and lets the patient use a large speak button when needed.
6. The other side hears translated voice audio through the assigned phone speaker or earphone.
7. The web app remains available for staff/admin workflows and usage review.

## Local Setup
```bash
npm install
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Seed login:
- Email: `staff@clinic.test`
- Password: `password1234`

Admin seed login:
- Email: `admin@clinic.test`
- Password: `password1234`

## Docs
See the `docs/` folder for product, architecture, data model, business model, UX, and implementation planning. The Android transition plan is in `docs/ANDROID_TRANSITION_ARCHITECTURE.md`, the first Android technical spike is in `docs/ANDROID_SPIKE_PLAN.md`, and the confirmed two-device architecture recommendation is in `docs/ANDROID_2_DEVICE_SPIKE_RESULT.md`.

## Android Spike
The first Android prototype lives in `android-spike/`. Open that folder directly in Android Studio after installation.
