# Android Diagnostics App

## Purpose

`android-diagnostics/` is a native Kotlin/Compose diagnostics app for the hospital-phone MVP path. It checks whether the proposed clinic hardware setup is viable before the production Android app is built.

Current staff field testing should use `android-staff-app/`, not this diagnostics app. The staff app follows the phone's normal media volume/output route and does not request Bluetooth permission. This diagnostics app is kept as an older hardware-inspection tool only.

The app validates:

- USB-C or wired microphone detection
- optional A2DP Bluetooth speaker detection for older hardware checks
- Google TTS playback for Korean, Chinese, Japanese, and English
- HID footpad/button input for Space, Enter, Numpad Enter, MediaPlayPause, and HeadsetHook
- Speaker test-tone playback
- Microphone input level without saving audio

It does not connect to OpenAI, does not include permanent API keys, does not store raw audio, and does not store transcripts.

## Build

From `C:\Users\user\Desktop\개발 작업\clinic-voice-room\android-diagnostics`:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\user\AppData\Local\Android\Sdk'
.\gradlew.bat :app:assembleDebug
```

The project includes `android.overridePathCheck=true` because the parent Windows path contains non-ASCII characters.

## Install And Run

1. Connect the hospital Android phone with USB debugging enabled.
2. Open `android-diagnostics/` in Android Studio or install the debug APK from:

```text
android-diagnostics/app/build/outputs/apk/debug/app-debug.apk
```

3. Grant microphone permission.
4. On Android 12 or newer, this legacy diagnostics app may ask for nearby/Bluetooth device permission if you choose to inspect Bluetooth routing. This is not required for the current staff translation app.

## Field Test Checklist

### Baseline Phone Only

- Launch the app with no accessories connected.
- Confirm built-in microphone and built-in speaker appear in device lists.
- Run the 4 second mic test and speak near the phone.
- Pass: mic level shows a clear peak and the speaker test tone is heard.

### USB-C Pin Microphone

- Connect the standard USB-C wired pin microphone.
- Tap Refresh.
- Pass: USB device, USB headset, or wired headset appears as an input device.
- Run the mic test while speaking into the pin mic.
- Pass: mic peak reacts clearly while the pin mic is connected.

### Bluetooth A2DP Speaker

- Pair and connect the standard Bluetooth speaker as media output.
- Tap Refresh.
- Pass: Bluetooth A2DP appears as an output device.
- Tap Play speaker test tone.
- Pass: the tone plays from the Bluetooth speaker, not from the phone speaker.

### Google TTS

- Confirm the engine line shows `com.google.android.tts` when Google TTS is available.
- Tap Speak for `ko-KR`, `zh-CN`, `ja-JP`, and `en-US`.
- Pass: each supported language produces audible speech through the current output device.
- The pass condition is app playback success. Pre-downloading voice packs is not required unless the phone fails playback.

### HID Footpad / Button

- Pair or connect the HID keyboard-style footpad/button.
- Press Space, Enter, Numpad Enter, MediaPlayPause, or HeadsetHook.
- Pass: the HID section shows key name, action, device id, vendor id, product id, source, and device name.
- Key repeat or duplicate events may appear, but the first DOWN/UP event must be visible.

## Report

Use Copy report to copy metadata only:

- device model and Android version
- permission status
- input/output device list
- mic test status
- speaker test status
- TTS engine and language results
- last supported HID key event

The report intentionally excludes audio data, raw recordings, patient text, and transcripts.

## OpenAI TTS Fallback Boundary

OpenAI TTS is intentionally not implemented in this v1 diagnostics app. If fallback TTS is needed later, implement it through a server-side Next.js Route Handler that:

- requires staff authentication
- keeps `OPENAI_API_KEY` server-side only
- accepts short translated text plus target language
- calls OpenAI TTS server-side
- streams or returns short-lived audio to the Android app
- avoids storing generated audio by default

Do not put OpenAI API keys, server secrets, or bearer tokens into the Android project.
