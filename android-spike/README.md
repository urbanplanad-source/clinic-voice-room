# Clinic Voice Room Android Spike

This is a Kotlin Android field-test spike for verifying OpenAI Realtime Translation audio output on a real Android device.

## Goal

Confirm whether `gpt-realtime-translate` over `POST /v1/realtime/translations/calls` returns a playable remote WebRTC audio track on Android.

## Open In Android Studio

1. Open Android Studio.
2. Select `Open`.
3. Choose this folder: `android-spike`.
4. Let Gradle sync finish.
5. Connect a Galaxy S24 with USB debugging enabled.
6. Run the `app` configuration on the phone.

## App Inputs

- Backend URL: defaults to the current Vercel deployment.
- Staff login: used by the test app to create rooms from the hospital device.
- Patient language: choose Chinese, Japanese, or English before creating a room.
- Room link or token: paste the patient join link or scan the Android app QR from the web waiting room.
- Room ID: resolved automatically from the room token.
- Role: choose `patient` or `staff`; the app sends the room token for either role during field tests.

## Expected First Test

1. Create a room in the web app.
2. In procedure mode, scan the Android app QR code. In consultation mode, paste the patient join link into the app.
3. Confirm that the backend URL and token are filled automatically.
4. Register the staff and patient remotes if needed.
5. Tap `연결`.
6. Speak in the selected direction.
7. Confirm whether translated audio is heard on the phone.

## App-Created Room Test

1. Open the app.
2. In `방 만들기`, confirm the staff login and patient language.
3. Tap `새 방 만들기`.
4. Confirm that `Room ID` and `방 링크 또는 토큰` are filled automatically.
5. Tap `연결`.
6. Register remotes and test the selected direction.

Do not put a permanent OpenAI API key in this Android project.
