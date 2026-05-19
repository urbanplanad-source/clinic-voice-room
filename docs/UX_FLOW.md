# UX_FLOW.md

> Status: current web field-test UX. Consultation and procedure rooms intentionally use different interaction models.

## UX Direction
The UI is minimal, premium, trustworthy, mobile-first, and inspired by Toss-style Korean fintech UX.

## Screens
- Staff Login: authenticate staff
- Staff Home: choose either consultation room or procedure room
- Patient Language Waiting Screen: the Galaxy Pad can stay open here; patient chooses language and confirms
- QR Waiting Room: show QR code after language confirmation
- Patient Entry: localized guest onboarding
- Consultation Room: real-time translated chat with staff text input, patient text input, patient examples, staff suggestions, risk chips, and summary draft
- Procedure Room: large microphone button, translated text, optional device/browser TTS playback, status indicator, end button for staff
- Session End: localized room closed state
- Internal Admin Dashboard: usage monitoring

## Procedure State Copy
- Ready: "마이크 버튼을 누르고 말씀하세요."
- Listening: "듣고 있습니다."
- Translating: "번역 중입니다."
- Playing: "상대방에게 통역 음성이 재생되고 있습니다."
- Locked: "상대방이 말하는 중입니다."

## Consultation Stages
- Intake: 방문 목적, 예약 여부, 당일 상담/시술 가능성 확인
- Medical: 복용약, 알레르기, 임신/수유, 증상 기간, 이전 시술 확인
- Procedure: 관심 시술, 원하는 효과, 시술 경험, 회복 기대치 확인
- Price and Schedule: 가격표, 카드 결제, 예약 희망일, 귀국/여행 일정 확인
- Summary: 오늘 상담 내용 요약, 추가 질문, 예약 또는 추후 결정 안내
