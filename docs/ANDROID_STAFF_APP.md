# Android Staff App

## Purpose

`android-staff-app/` is the native hospital-phone app for MediVoice hospital staff.

It is not a WebView wrapper. It is a Kotlin + Jetpack Compose app that signs in to the existing Next.js backend, creates a QR room for the patient web app, streams short staff turns through OpenAI Realtime with manual push-to-talk turn boundaries, falls back to server STT/translation upload when Realtime fails, then plays the translated result with Android/Google TTS.

The visible field UI now supports two staff workflows:

- Procedure mode: large push-to-talk translation for a patient lying down, with translated TTS played through the hospital phone output route.
- Face-to-face mode: one-device, two-way local interpretation using the promoted fast face-to-face engine, instant templates, Android TTS playback, and on-device temporary conversation summary.

## Current App Scope

- Staff login through `/api/auth/login`.
- Procedure room creation through `/api/rooms`.
- Face-to-face mode is local Android-only and does not create a backend room.
- Patient QR/link display using the existing patient web join URL.
- Room state polling through `/api/rooms/{roomId}`.
- Message polling through `/api/rooms/{roomId}/messages`.
- Procedure staff voice Realtime delivery through `/api/realtime/session-token`, with `/api/procedure-turns` used to persist the completed message or as upload fallback.
- Patient-to-staff translated message receiving in Android.
- Staff-to-patient translated message delivery to patient web.
- Android TTS playback:
  - staff Korean -> patient language for staff turns
  - patient language -> Korean for patient turns
- TTS uses Android media audio output/volume (`USAGE_MEDIA`). Staff control loudness with the phone's normal media volume, and any optional external speaker should be paired in Android system settings. The staff app does not request Bluetooth/nearby-device permission.
- HID footpad/button toggle for Space, Enter, Numpad Enter, Media Play/Pause, and Headset Hook. Media Play/Pause and Headset Hook are handled through both activity key events and Android MediaSession media-button routing.
- Mic permission recovery from the in-room mic panel.
- Staff session restore through the server-issued `cvr_session` cookie when "??湲곌린?먯꽌 濡쒓렇???좎?" is enabled.
- Active rooms hide logout and require a confirmation dialog before room termination, so staff do not accidentally leave a patient room open or end it with one stray tap.

## Architecture Boundary

Android staff voice now uses Realtime-first manual turns:

```text
request server-issued ephemeral Realtime token
-> stream 24 kHz PCM from Android AudioRecord over Realtime WebSocket
-> staff button stop commits the input audio buffer manually
-> Realtime returns translated text
-> server stores a short room message
-> Android/patient web poll messages
-> Android TTS or browser display/playback
```

If Realtime returns no text or errors, the same in-memory PCM turn is wrapped as WAV and sent to the existing bounded upload route. The old `android-spike/` remains reference-only.

## Security And Data Rules

- No permanent OpenAI API key in Android.
- No server secrets in Android.
- No raw audio file storage in Android.
- No full transcript permanent storage.
- Failed non-identifying quality metrics are kept in app-private storage only, contain no transcript or audio, and are capped at 200 queued payloads.
- Short room messages are used for live delivery and are deleted when the room ends.
- Android cleartext HTTP is disabled; production backend URLs must use `https://`.
- The app auto-normalizes a backend value like `voice.insightmedi.co.kr` to `https://voice.insightmedi.co.kr`.
- The Android app stores no staff password. When login persistence is enabled, it stores only the server-issued session cookie in app-private storage and verifies it with `/api/me` on app start.
- Turning off `??湲곌린?먯꽌 濡쒓렇???좎?` or logging out clears the saved session cookie from the device.

## Build

Run Android compilation, unit tests, and field lint without signing:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\verify-medivoice-android.ps1"
```

Build the installable, release-signed field APK with the protected keystore prompt:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Documents\MediVoiceKeys\build-medivoice-field.ps1"
```

Direct `assembleField` or `copyBrandedFieldApk` packaging now fails when the four release-signing environment variables are missing. This prevents a debug-signed APK from being mistaken for a field release.

Installable field APK after the signed build:

```text
android-staff-app/app/build/outputs/apk/field/medivoice-0.3.38-field.apk
```
Release build sanity check:

```powershell
.\gradlew.bat :app:assembleRelease
```

Google Play upload bundle build:

```powershell
.\gradlew.bat :app:copyBrandedReleaseBundle
```

Store listing image assets:

```text
docs/play-store-assets/medivoice-hires-icon-512.png
docs/play-store-assets/medivoice-feature-graphic-1024x500.png
```

Google Play does not require a separate splash image upload. Android 12+ derives the launch splash from the app icon and theme; the Android app uses an adaptive launcher icon for that path.

If release signing env vars are not set, Gradle produces an unsigned packaging artifact:

```text
android-staff-app/app/build/outputs/apk/release/app-release-unsigned.apk
```

Do not install or distribute the unsigned release APK. Use it only to verify release packaging.

Current app version:

- versionName: `0.3.38`
- versionCode: `50`

Pinned build stack:

- Gradle wrapper: 8.11.1
- Android Gradle Plugin: 8.7.3
- Kotlin: 2.0.21
- Compose BOM: 2024.12.01
- minSdk: 26
- compileSdk/targetSdk: 35
- Google Play field APK: `android-staff-app/app/build/outputs/apk/field/medivoice-0.3.38-field.apk`
- Google Play release AAB filename after bundle build: `android-staff-app/app/build/outputs/bundle/release/medivoice-0.3.38-release.aab`
- Store privacy policy page draft: `/privacy`

`android.overridePathCheck=true` is set for Korean workspace paths.

## Release Signing

Do not commit keystores or passwords. For a signed release build, set these environment variables before running `:app:assembleRelease`:

```powershell
$env:CVR_ANDROID_KEYSTORE='C:\secure\medivoice-release.jks'
$env:CVR_ANDROID_KEYSTORE_PASSWORD='...'
$env:CVR_ANDROID_KEY_ALIAS='medivoice'
$env:CVR_ANDROID_KEY_PASSWORD='...'
.\gradlew.bat :app:assembleRelease
```

When all four values are present, Gradle signs the release variant. When they are missing, release builds remain unsigned for CI/build sanity checks.

## Deployment Checklist

Before field testing against `voice.insightmedi.co.kr`:

1. Deploy the current Next.js web/API changes to Vercel.
2. Confirm `OPENAI_API_KEY` and OpenAI model env vars are set on Vercel.
3. Build the Android APK.
4. Install `MediVoice` on the hospital phone.
5. Use the phone's normal media volume for TTS loudness. If a Bluetooth speaker is needed, pair it in Android system settings before opening the room. The staff app itself must not request Bluetooth/nearby-device permission.
6. Grant microphone permission when the in-room mic panel asks for it. The app should not show a permission prompt immediately on login.
7. Connect the USB-C or wired pin microphone.
8. Confirm the mic button works. If microphone permission is missing, the in-room mic panel should show `留덉씠??沅뚰븳 ?덉슜`.
9. With `??湲곌린?먯꽌 濡쒓렇???좎?` enabled, close and reopen the app.
10. Pass: the app restores the staff session without asking for the password and shows the room creation screen.

Recommended OpenAI env values:

```text
OPENAI_TEXT_TRANSLATION_MODEL=gpt-5.5
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-4o-transcribe
```

The server defaults `OPENAI_TEXT_TRANSLATION_MODEL` to `gpt-5.5` when unset. It normalizes legacy `OPENAI_REALTIME_MODEL=gpt-realtime-translate` to `gpt-realtime` for the current general Realtime path, and legacy `OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-realtime-whisper` to `gpt-4o-transcribe`.

## Face-To-Face Mode Field Test

1. Log in as staff.
2. Confirm the visible mode order is `시술방 만들기` first and `대면모드` second.
3. Select `대면모드`.
4. Select patient language.
5. Start face-to-face mode.
6. Confirm the screen shows patient-language area on top, Korean area on bottom, and no `실험` text.
7. Staff presses the Korean mic, speaks a short Korean sentence, then stops.
8. Pass: Android shows Korean source text, translated patient-language text, and plays translated TTS.
9. Patient presses the patient-language mic, speaks, then stops.
10. Pass: Android shows patient-language source text, Korean translation, and plays Korean TTS.
11. Tap summary after a few turns.
12. Pass: Android shows patient-language and Korean summaries without storing the transcript in the database.

## Procedure Mode Field Test

1. Log in as staff.
2. Select `시술방 만들기`.
3. Select patient language.
4. Create the procedure room.
5. Scan the QR on the patient phone and enter the room.
6. Confirm Android changes from QR wait to patient-ready state.
7. Set the phone media volume and place the phone or optional external media speaker where the lying patient can hear it.
8. Staff presses the large mic button, speaks one short Korean procedure phrase, then presses again.
9. Pass: Android displays recognized Korean/translated text and plays patient-language TTS through the intended output route.
10. Tap `직원폰 다시 듣기`.
11. Pass: the latest translated phrase replays through the same output route.
12. Patient uses the patient web mic to speak.
13. Pass: Android receives the Korean translation and Korean TTS plays for staff.

## Hardware Field Test

- USB-C/wired mic: connect before and after app launch; staff recording should use the intended mic route on the hospital phone.
- Audio output: translated TTS should follow the phone's current media output route. Test once with the phone speaker, and optionally again after connecting an external speaker in Android system settings.
- HID footpad/button: Space, Enter, Numpad Enter, Media Play/Pause, and Headset Hook should toggle the same mic button.
- During translation/busy states, repeated footpad presses should not start a second recording.
- If microphone permission is denied, enter a room and confirm the mic panel offers `留덉씠??沅뚰븳 ?덉슜`.
- With an active room open, confirm the top logout button is not shown. End the room through the confirmed `諛?醫낅즺` action first.

## Known Release Notes

- Android v1 is online-only and requires the deployed Next.js backend.
- Android v0.3.21 retires consultation and the legacy stable face-to-face mode from the visible Android UI, promotes the fast face-to-face engine as `대면모드`, keeps procedure mode, and stores restoration notes for the retired modes in `docs/android-retired-modes-2026-06-27.md`.
- Android v0.3.20 tightens XERF handling so Korean staff speech misheard as `셀프 리프팅` or translated as `Self lifting` is normalized to XERF in glossary, Realtime prompt guidance, and Android local face-to-face text correction.
- Android v0.3.19 adds dermatology and plastic-surgery price-list terminology to the web glossary, Realtime prompts, and Android local normalization, covering common lifting devices, filler brands, toxin brands, skin boosters, peel care, acne-scar care, and body-area Botox names while excluding fixed price values from app logic.
- Android v0.3.18 adds Re2O / 리투오 Korean transcription hints, glossary normalization, Realtime prompt preservation, and Android local display/TTS text correction so Re2O skinbooster mentions are less likely to be misrecognized or mistranslated.
- Android v0.3.17 removes the experimental face-to-face `안정 대면` switch, simplifies the center strip to match the regular face-to-face layout, and adds an experimental-only in-memory conversation summary flow that shows patient-language and Korean summaries without storing the transcript in the database.
- Android v0.3.16 hardens instant-template Realtime turns by ignoring delayed transcripts from deleted input items, and raises the experimental template probe window to improve template-hit reliability without changing stable face-to-face timing.
- Android v0.3.15 makes the face-to-face experimental mode use faster Realtime turn timing similar to the consultation room path. Instant templates remain part of Android local interpreter behavior, and high-risk experimental results are labeled as needing confirmation rather than as already verified.
- Android v0.3.14 adds a separate Android-only face-to-face experimental mode with instant templates first, a Realtime-v1 engine boundary for future Bidi replacement, experiment/result status labels, and TTS interruption for the next speaker.
- Android v0.3.13 adds a conservative Android local-interpreter instant-template path for 20 approved Korean staff phrases, including Brazilian Portuguese translations, while keeping unmatched speech on the existing Realtime text-only path.
- Android v0.3.12 switches local interpreter Realtime back to text-only responses, uses warmed Android TTS for playback, and shortens the translated-output quiet window to reduce the delay after the mic button is released.
- Android v0.3.11 rolls local interpreter mode back to explicit manual Realtime turn commits while keeping Realtime audio output playback, because the v0.3.10 server-VAD auto-response experiment could feel slower in field testing.
- Android v0.3.10 keeps the server prompt and terminology templates in the Realtime session while enabling standard Realtime server VAD auto responses for local interpreter mode, so translated audio can start as soon as the model begins speaking and the Android mic stops capturing to reduce echo.
- Android v0.3.9 intercepts Android system back navigation, waits briefly for Realtime input transcripts before saving staff voice turns, avoids the Korean-source fallback sentence when transcription is missing, strengthens Rejuran Healer/Juvelook brand normalization, tightens the native setup/conversation UI for mobile and tablet screens, and shows login progress/failure text directly on the Android login screen.
- Android v0.3.8 increases the staff recording safety limit from 12 seconds to 60 seconds so longer explanations are not auto-submitted prematurely.
- Android v0.3.7 reduces patient-to-staff receive latency by polling messages before room state, using a 300ms poll window while the patient is speaking/translating, and letting patient web upload start without waiting for noncritical state-transition POSTs.
- Android v0.3.6 forces Realtime responses to text-only output, returns Android Realtime turns before the persist POST finishes, retries that persist in the background, wakes the Realtime completion loop from `response.done`, and pre-warms Korean plus patient-language TTS after room setup.
- Android v0.3.5 adds a non-debuggable `field` APK build, enables R8/resource shrinking for field testing, warms `/api/me` on app start, removes the blocking `translating_to_patient` state round-trip before TTS, shortens Realtime quiet completion to 300ms, and keeps the mic helper visible while Realtime prepares.
- Android v0.3.4 changes the staff mic start UX to optimistic local recording: the button turns red immediately, recording starts before the server state transition returns, and the mic helper explains that Realtime can still be preparing.
- Android v0.3.3 starts staff Realtime preconnect immediately after room creation, reduces recorder stop wait from 1500ms to 250ms, and adds timing logs for HTTP, Realtime token/socket/first text/local result, persist, and upload fallback.
- Android v0.3.2 keeps the v0.3.1 preconnect behavior, separates room polling from user action requests, shortens patient-entry polling, and matches the web Realtime completion behavior by returning after a short quiet window once translated text starts streaming.
- Android v0.3.1 starts Realtime preparation automatically when the patient enters, polls faster while waiting for patient entry, no longer waits for Realtime connection before turning the mic red, and keeps saved-session restore off the login request queue.
- Android v0.3.0 uses OpenAI Realtime WebSocket with manual staff push-to-talk turn commits, while retaining the previous upload route as fallback.
- Android v0.2.9 follows the provided screenshots more closely: large mode cards, red logout below procedure room creation, 3-column patient-language selection with English prompts, and a large QR waiting screen with explicit QR error handling.
- Android v0.2.8 removes Android's internal `roomToken` QR fallback, adds direction-aware setup transitions, and expands the QR waiting screen's patient notice preview.
- Android v0.2.7 adds smooth animated transitions between the staff setup screens and updates field-test guidance to use `patientJoinCode` rather than `roomToken` as the QR handoff value.
- Android v0.2.6 separates the staff app flow into room type selection, patient language selection, QR waiting, and conversation screens. New QR links use `patientJoinCode` first and move patients to a room-token-free `/room/patient/{roomId}` URL after entry.
- Android v0.2.5 makes the consultation mic stop action immediate: the second tap now bypasses room-start guards and the mic button leaves the red recording state before translation processing continues.
- Android v0.2.4 makes consultation mode look closer to the web chat room: larger mist chat area, rounded bottom mic dock, icon mic/send/replay controls, and timestamped bubbles.
- Android v0.2.3 makes Android and web staff QR links both include `?mode=consultation|procedure` for clearer field-test handoff. The server still uses `TranslationRoom.roomMode` as the source of truth.
- Android v0.2.2 puts the active translation panel before room metadata after the patient joins, so staff see chat/mic controls first.
- Android v0.2.1 and later use the phone's normal media volume/output route for TTS and request no Bluetooth permission.
- The v0.3.38 field APK is non-debuggable, and Field packaging is blocked unless the release signing environment is complete. Verify the signing certificate before device distribution.
- A real two-phone field test is required before marking the app production-ready.
