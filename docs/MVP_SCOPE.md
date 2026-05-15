# MVP_SCOPE.md

> Status: this document describes the original web MVP scope. The current product direction is Android-first hospital-provisioned two-device interpretation. See [ANDROID_TRANSITION_ARCHITECTURE.md](ANDROID_TRANSITION_ARCHITECTURE.md).

## MVP Objective
Deliver a working hospital-use prototype where a Korean hospital staff member creates a translation room, a foreign patient joins through a paired hospital-provisioned device or fallback QR flow, each side speaks with controlled turn taking, and the other side hears translated voice output.

## Required Features
- Staff authentication with hospital association and plan type
- Language selection: Chinese, Japanese, English, Russian, Vietnamese, Indonesian
- Room creation with hard-to-guess guest URL, QR fallback, or paired device flow
- Patient guest join without login
- Room states from `waiting_for_patient` through `ended`
- Push-to-talk UI with large touch targets
- Two-way voice translation
- Audio playback on the opposite device
- Staff room termination
- Usage tracking by hospital, staff, room, and language
- Minimal admin dashboard

## MVP Success Criteria
1. Two devices can connect to one room through pairing or QR fallback.
2. Both can speak using on-screen mic controls.
3. Voice translation is heard on the opposite device.
4. Room locks prevent overlap.
5. Usage is saved by hospital.
6. Partner hospitals can be flagged as free.
7. The codebase can support clinic pilot testing.
