# UX_FLOW.md

> Status: current web field-test UX. New web entry points expose procedure QR translation, installable face-to-face procedure translation, and staff text translation only. Legacy consultation code remains for compatibility but is not shown in the staff web home.

## UX Direction
The UI is minimal, premium, trustworthy, mobile-first, and inspired by Toss-style Korean fintech UX.

## Screens
- Staff Login: authenticate staff
- Staff Home: choose procedure QR translation, installable face-to-face translation, or staff text translation
- Patient Language Waiting Screen: the Galaxy Pad can stay open here; patient chooses language and confirms
- QR Waiting Room: show QR code after language confirmation
- Patient Entry: localized guest onboarding
- Procedure Room: large microphone button, translated text, optional device/browser TTS playback, status indicator, end button for staff
- Installable Face-to-Face Room: one browser window stretched across two monitors, staff panel on the left with PageUp/F8 and mouse middle/back test input, customer panel on the right with PageDown/F9 and mouse right/forward test input
- Session End: localized room closed state
- Internal Admin Dashboard: usage monitoring

## Procedure State Copy
- Ready: "마이크 버튼을 누르고 말씀하세요."
- Listening: "듣고 있습니다."
- Translating: "번역 중입니다."
- Playing: "상대방에게 통역 음성이 재생되고 있습니다."
- Locked: "상대방이 말하는 중입니다."

## Staff Text Translation
- Staff-only text translation remains available from the staff home.
- It is separate from room creation and does not expose a customer account or QR flow.
