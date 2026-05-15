# UX_FLOW.md

> Status: this document describes the original web MVP UX. The current product direction is Android-first hospital-provisioned two-device interpretation. See [ANDROID_TRANSITION_ARCHITECTURE.md](ANDROID_TRANSITION_ARCHITECTURE.md).

## UX Direction
The UI is minimal, premium, trustworthy, mobile-first, and inspired by Toss-style Korean fintech UX.

## Screens
- Staff Login: authenticate staff
- Staff Home: select language and create room
- QR Waiting Room: show QR code and wait for patient in the web MVP or fallback flow
- Patient Entry: localized guest onboarding and microphone permission
- Active Translation Room: large microphone button, status indicator, end button for staff
- Session End: localized room closed state
- Internal Admin Dashboard: usage monitoring

## State Copy
- Ready: "마이크 버튼을 누르고 말씀하세요."
- Listening: "듣고 있습니다."
- Translating: "번역 중입니다."
- Playing: "상대방에게 통역 음성이 재생되고 있습니다."
- Locked: "상대방이 말하는 중입니다."
