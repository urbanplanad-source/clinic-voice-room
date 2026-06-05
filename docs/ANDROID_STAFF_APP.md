# Android Staff App

## Purpose

`android-staff-app/` is the native hospital-phone app for Clinic Voice Room staff.

It is not a WebView wrapper. It is a Kotlin + Jetpack Compose app that signs in to the existing Next.js backend, creates a QR room for the patient web app, records short staff turns with Android native audio, uploads them to server route handlers for STT and translation, then plays the translated result with Android/Google TTS.

The app now supports both staff workflows:

- Consultation mode: chat-like two-way voice translation, with text fallback.
- Procedure mode: large push-to-talk translation for a patient lying down, with translated TTS played through the hospital phone output route.

## Current App Scope

- Staff login through `/api/auth/login`.
- Consultation/procedure room creation through `/api/rooms`.
- Patient QR/link display using the existing patient web join URL.
- Room state polling through `/api/rooms/{roomId}`.
- Message polling through `/api/rooms/{roomId}/messages`.
- Consultation staff voice upload through `/api/consultation-voice-turns`.
- Procedure staff voice upload through `/api/procedure-turns`.
- Consultation text fallback through `/api/translate-text`.
- Patient-to-staff translated message receiving in Android.
- Staff-to-patient translated message delivery to patient web.
- Android TTS playback:
  - staff Korean -> patient language for staff turns
  - patient language -> Korean for patient turns
- TTS uses Android media audio output/volume (`USAGE_MEDIA`). Staff control loudness with the phone's normal media volume, and any optional external speaker should be paired in Android system settings. The staff app does not request Bluetooth/nearby-device permission.
- HID footpad/button toggle for Space, Enter, Numpad Enter, Media Play/Pause, and Headset Hook. Media Play/Pause and Headset Hook are handled through both activity key events and Android MediaSession media-button routing.
- Mic permission recovery from the in-room mic panel.
- Staff session restore through the server-issued `cvr_session` cookie when "이 기기에서 로그인 유지" is enabled.
- Active rooms hide logout and require a confirmation dialog before room termination, so staff do not accidentally leave a patient room open or end it with one stray tap.

## Architecture Boundary

Android v1 intentionally uses bounded turns:

```text
record short turn in memory
-> upload WAV bytes to Next.js route
-> OpenAI STT/translation on the server
-> server stores a short room message
-> Android/patient web poll messages
-> Android TTS or browser display/playback
```

Android v1 does not use OpenAI Realtime/WebRTC. The old `android-spike/` remains reference-only.

## Security And Data Rules

- No permanent OpenAI API key in Android.
- No server secrets in Android.
- No raw audio file storage in Android.
- No full transcript permanent storage.
- Short room messages are used for live delivery and are deleted when the room ends.
- Android cleartext HTTP is disabled; production backend URLs must use `https://`.
- The app auto-normalizes a backend value like `voice.insightmedi.co.kr` to `https://voice.insightmedi.co.kr`.
- The Android app stores no staff password. When login persistence is enabled, it stores only the server-issued session cookie in app-private storage and verifies it with `/api/me` on app start.
- Turning off `이 기기에서 로그인 유지` or logging out clears the saved session cookie from the device.

## Build

Expected local environment:

```powershell
$env:JAVA_HOME='C:\Users\user\Desktop\개발 작업\clinic-voice-room\.tools\jdk17\jdk-17.0.19+10'
$env:ANDROID_HOME='C:\Users\user\AppData\Local\Android\Sdk'
cd "C:\Users\user\Desktop\개발 작업\clinic-voice-room\android-staff-app"
.\gradlew.bat :app:assembleDebug
```

Installable debug APK after build:

```text
android-staff-app/app/build/outputs/apk/debug/app-debug.apk
android-staff-app/app/build/outputs/apk/debug/cvr-staff-0.2.9-debug.apk
```

Latest local field-test APK:

```text
android-staff-app/app/build/outputs/apk/debug/cvr-staff-0.2.9-debug.apk
SHA256: 2FE35FFF40D90CA007622F08C8EDA4FBA6EAD1E4652C9ADBC20A7CCCC5695267
```

Release build sanity check:

```powershell
.\gradlew.bat :app:assembleRelease
```

If release signing env vars are not set, Gradle produces an unsigned packaging artifact:

```text
android-staff-app/app/build/outputs/apk/release/app-release-unsigned.apk
```

Do not install or distribute the unsigned release APK. Use it only to verify release packaging.

Current app version:

- versionName: `0.2.9`
- versionCode: `11`

Pinned build stack:

- Gradle wrapper: 8.11.1
- Android Gradle Plugin: 8.7.3
- Kotlin: 2.0.21
- Compose BOM: 2024.12.01
- minSdk: 26
- compileSdk/targetSdk: 35

`android.overridePathCheck=true` is set for Korean workspace paths.

## Release Signing

Do not commit keystores or passwords. For a signed release build, set these environment variables before running `:app:assembleRelease`:

```powershell
$env:CVR_ANDROID_KEYSTORE='C:\secure\cvr-staff-release.jks'
$env:CVR_ANDROID_KEYSTORE_PASSWORD='...'
$env:CVR_ANDROID_KEY_ALIAS='cvr-staff'
$env:CVR_ANDROID_KEY_PASSWORD='...'
.\gradlew.bat :app:assembleRelease
```

When all four values are present, Gradle signs the release variant. When they are missing, release builds remain unsigned for CI/build sanity checks.

## Deployment Checklist

Before field testing against `voice.insightmedi.co.kr`:

1. Deploy the current Next.js web/API changes to Vercel.
2. Confirm `OPENAI_API_KEY` and OpenAI model env vars are set on Vercel.
3. Build the Android APK.
4. Install `CVR Staff` on the hospital phone.
5. Use the phone's normal media volume for TTS loudness. If a Bluetooth speaker is needed, pair it in Android system settings before opening the room. The staff app itself must not request Bluetooth/nearby-device permission.
6. Grant microphone permission when the in-room mic panel asks for it. The app should not show a permission prompt immediately on login.
7. Connect the USB-C or wired pin microphone.
8. Confirm the mic button works. If microphone permission is missing, the in-room mic panel should show `마이크 권한 허용`.
9. With `이 기기에서 로그인 유지` enabled, close and reopen the app.
10. Pass: the app restores the staff session without asking for the password and shows the room creation screen.

Recommended OpenAI env values:

```text
OPENAI_TEXT_TRANSLATION_MODEL=gpt-5.2
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_REALTIME_MODEL=gpt-realtime
```

The server normalizes legacy `OPENAI_TEXT_TRANSLATION_MODEL=gpt-5.5` to `gpt-5.2` and legacy `OPENAI_REALTIME_MODEL=gpt-realtime-translate` to `gpt-realtime`.

## Consultation Mode Field Test

1. Log in as staff.
2. Select `상담`.
3. Select patient language.
4. Create the consultation room.
5. Scan the QR on the patient phone and enter the room.
6. Confirm Android changes from QR wait to patient-ready state.
7. Staff presses the large mic button, speaks a short Korean sentence, then presses again.
8. Pass: Android shows the staff message in the chat list, plays translated TTS, and the patient web shows the translated message.
9. Patient presses the web mic, speaks a short message, then stops.
10. Pass: patient web shows the patient message, Android receives the Korean translation, and Android Korean TTS plays.
11. Type a Korean text fallback message in Android and send.
12. Pass: Android clears the text input, shows the message in chat, and patient web receives the translated text.
13. While the patient is speaking, press the Android mic or footpad.
14. Pass: Android does not start recording and shows a wait message.
15. Tap `방 종료`.
16. Pass: Android shows a confirmation dialog. `계속 사용` keeps the room open; `방 종료` ends it and returns to room creation.

## Procedure Mode Field Test

1. Log in as staff.
2. Select `시술`.
3. Select patient language.
4. Create the procedure room.
5. Scan the QR on the patient phone and enter the room.
6. Confirm Android changes from QR wait to patient-ready state.
7. Set the phone media volume and place the phone or optional external media speaker where the lying patient can hear it.
8. Staff presses the large mic button, speaks one short Korean procedure phrase, then presses again.
9. Pass: Android displays recognized Korean/translated text and plays patient-language TTS through the intended output route.
10. Tap `다시 듣기`.
11. Pass: the latest translated phrase replays through the same output route.
12. Patient uses the patient web mic to speak.
13. Pass: Android receives the Korean translation and Korean TTS plays for staff.

## Hardware Field Test

- USB-C/wired mic: connect before and after app launch; staff recording should use the intended mic route on the hospital phone.
- Audio output: translated TTS should follow the phone's current media output route. Test once with the phone speaker, and optionally again after connecting an external speaker in Android system settings.
- HID footpad/button: Space, Enter, Numpad Enter, Media Play/Pause, and Headset Hook should toggle the same mic button.
- During translation/busy states, repeated footpad presses should not start a second recording.
- If microphone permission is denied, enter a room and confirm the mic panel offers `마이크 권한 허용`.
- With an active room open, confirm the top logout button is not shown. End the room through the confirmed `방 종료` action first.

## Known Release Notes

- Android v1 is online-only and requires the deployed Next.js backend.
- Android v1 uses server route handlers instead of OpenAI Realtime/WebRTC.
- Android v0.2.9 follows the provided screenshots more closely: large mode cards, red logout below procedure room creation, 3-column patient-language selection with English prompts, and a large QR waiting screen with explicit QR error handling.
- Android v0.2.8 removes Android's internal `roomToken` QR fallback, adds direction-aware setup transitions, and expands the QR waiting screen's patient notice preview.
- Android v0.2.7 adds smooth animated transitions between the staff setup screens and updates field-test guidance to use `patientJoinCode` rather than `roomToken` as the QR handoff value.
- Android v0.2.6 separates the staff app flow into room type selection, patient language selection, QR waiting, and conversation screens. New QR links use `patientJoinCode` first and move patients to a room-token-free `/room/patient/{roomId}` URL after entry.
- Android v0.2.5 makes the consultation mic stop action immediate: the second tap now bypasses room-start guards and the mic button leaves the red recording state before translation processing continues.
- Android v0.2.4 makes consultation mode look closer to the web chat room: larger mist chat area, rounded bottom mic dock, icon mic/send/replay controls, and timestamped bubbles.
- Android v0.2.3 makes Android and web staff QR links both include `?mode=consultation|procedure` for clearer field-test handoff. The server still uses `TranslationRoom.roomMode` as the source of truth.
- Android v0.2.2 puts the active translation panel before room metadata after the patient joins, so staff see chat/mic controls first.
- Android v0.2.1 and later use the phone's normal media volume/output route for TTS and request no Bluetooth permission.
- The APK is currently a debug build for field testing. A signed release build and staff-device provisioning are still needed before production distribution.
- A real two-phone field test is required before marking the app production-ready.
