# Clinic Voice Room Android Spike

This is a throwaway Kotlin Android spike for verifying OpenAI Realtime Translation audio output on a real Android device.

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

- Backend URL: the current Next.js or Cloudflare Tunnel base URL.
- Room ID: an existing translation room ID.
- Room token: required for `role = patient`.
- Role: begin with `patient` because `staff` currently depends on browser cookie auth.

## Expected First Test

1. Create a room in the web app.
2. Copy the `roomId` from the staff room URL: `/staff/rooms/{roomId}`.
3. Copy the `roomToken` from the patient join URL: `/room/join/{roomToken}`.
4. Start this Android app as `patient`.
5. Tap `Request Token`.
6. Tap `Connect`.
7. Speak in the patient language.
8. Confirm whether Korean translated audio is heard on the phone.

Do not put a permanent OpenAI API key in this Android project.
