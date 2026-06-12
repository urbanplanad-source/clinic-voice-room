# Field Test Guide

## Recommended Room Pairing

Use one room link as the only handoff value. Do not ask staff to type a room ID.

1. Staff logs in to the Android staff app and creates a room.
2. For consultation mode, scan the patient web QR code.
3. For procedure mode, scan the patient web QR code on the patient device.
4. The staff device uses the doctor's wired or close microphone.
5. The patient device stays near the patient and uses its own microphone.
6. If `이 기기에서 로그인 유지` is enabled, restart the Android app once and confirm the staff session is restored without re-entering the password.
7. The old Android spike is reference-only and should not be used for v1 field testing.

## Link Types

Patient web link:

```txt
https://voice.insightmedi.co.kr/room/join/{patientJoinCode}?mode=consultation
```

Legacy Android spike link, reference only:

```txt
clinicvoiceroom://room/join?joinCode={patientJoinCode}&mode=procedure&backend=https%3A%2F%2Fvoice.insightmedi.co.kr
```

The Android staff app shows the patient web link as the primary QR. Patients still join in the browser and do not install an app. After joining, the patient is redirected to a room-token-free `/room/patient/{roomId}` URL.

## Why Join-Code QR Is Better

- `roomId` is an internal database ID and should stay hidden from staff.
- The QR uses a separate temporary `patientJoinCode`, not the room's internal `roomToken`.
- A full join link can be pasted, scanned, or sent without extra pairing steps.
- After the patient enters, the server issues an HttpOnly patient room cookie and redirects away from the join-code URL.
- The app can safely resolve the room server-side and avoid wrong-room pairing in nearby consultation rooms.

## Device TTS Setup Checklist (새 병원 패드/폰 셋업 시 필수)

Android 기본 TTS 엔진은 제조사(삼성 등) 엔진으로 설정된 경우 태국어·베트남어 등 일부 언어 품질이 불안정하다. 새 병원에 디바이스를 배포하기 전에 반드시 Google TTS 엔진으로 변경한다. 이 설정으로 전 언어 읽기가 안정적이므로 서버 측 뉴럴 TTS는 사용하지 않는다.

1. `설정 > 접근성 > TalkBack`(또는 `읽어서 들려주기`) 경로에서 음성 출력 엔진 설정으로 이동.
2. `텍스트 음성 변환(TTS) 출력 > 기본 엔진`을 **Google 음성 서비스(Google Text-to-speech)**로 변경. (미설치 기기는 Play 스토어에서 "Google 음성 서비스" 설치 후 선택)
3. 해당 병원에서 쓰는 환자 언어(중국어, 일본어, 태국어, 베트남어 등) 음성 데이터를 미리 다운로드.
4. 환자 웹 룸에서 언어별로 번역 메시지 자동 재생 + `다시 듣기`가 자연스러운 음성으로 나오는지 확인.

## Low-Latency Staff App Setup

The Android staff app is the primary field-test surface for hospital staff. The patient side remains the web room opened from QR.

- Prefer a wired USB-C/Lightning microphone, wired headset, or close tablet microphone.
- Avoid Bluetooth microphones for speech input. For output, use the phone's normal media volume first; optional Bluetooth speakers can be connected in Android system settings when a louder patient-side output is needed.
- Keep the active speaker within 20-40 cm of the microphone.
- Use one speaker at a time. Push-to-talk should define the direction instead of mixing both voices into one stream.
- Join the room and grant microphone permission before the real conversation starts. The staff app should not ask for Bluetooth permission; output follows the phone's current media route.
- If microphone permission was denied, enter a room and use the in-room `마이크 권한 허용` button rather than a separate diagnostic screen.
- In consultation mode, staff should use the Android push-to-talk mic first; use Android text fallback only when speech recognition is not reliable.
- In procedure mode, staff should speak short Korean chunks through the Android push-to-talk mic and replay translated audio when needed.
- 대면 모드는 시작 후 `연결 중...` 표시가 사라진 뒤 첫 발화를 시작하면 가장 빠르다.
- Use two devices: Android hospital phone for staff, patient phone browser for the patient.
- In consultation mode, each side should hear incoming translated messages automatically when browser/Android TTS is available.
- Use the `Replay` / `다시 듣기` button after a missed or noisy translated message.
- End active Android rooms with the confirmed `방 종료` flow before logging out or handing the phone to another staff member.

## Pilot Metrics

Do not store raw audio or full transcripts by default. For field testing, record only operational metadata:

- Time from push-to-talk start to first translated text delta.
- Time from push-to-talk stop to final translated text.
- Room created, joined, ended timestamps.
- Language, mode, staff role, and anonymized room/session identifiers.
- Reconnects, token failures, microphone permission failures, and manual retries.
- Recovery checks after microphone/TTS/server errors.

## Safety Notes

- Confirm numbers, dates, medication names, allergies, and procedure names on screen before acting on them.
- If voice output is delayed or unstable, continue with text-only interpretation.
- If automatic playback is blocked by the browser, press the replay button after the first user interaction on the page.
- If same-language speech appears to produce no translation, treat it as a pass-through situation and repeat or show the original text.
- If microphone recording fails, the room should return to the ready state and the next push-to-talk attempt should be available without creating a new room.

## Procedure Latency Tuning

- Doctor-to-patient translation should appear after each bounded push-to-talk turn and play automatically through Android TTS.
- In procedure mode, the app should not require long speech segments. Short manual turn-taking is preferred so the patient can respond quickly.
- The patient web mic should remain available after doctor speech while translation is being displayed or played. Only block patient input while the doctor is actively speaking.
- For the fastest field workflow, the doctor should speak in short clinical chunks: one instruction, one warning, or one question at a time.
- In Android procedure mode, a paired HID footpad/remote can toggle push-to-talk with Space, Enter, Numpad Enter, Media Play/Pause, or Headset Hook.
- Optional external speakers are acceptable for audio output tests, but avoid relying on Bluetooth microphones for clinical input. Prefer a wired or close device microphone for the doctor's speech.
- Procedure mode should prioritize fast translated text delivery, then read that text aloud on the Android output route with Google/Android TTS. This avoids permanent API keys in Android and avoids waiting for server-generated speech.
- If realtime broadcast is delayed, both Android and patient web should still catch the saved procedure message through `/api/rooms/{roomId}/messages` polling.
