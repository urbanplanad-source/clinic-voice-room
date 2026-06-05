# Clinic Voice Room Android Diagnostics

Native Android diagnostics app for the early hospital phone hardware path.

Current field testing should use `android-staff-app/`. The staff translation app uses the phone's normal media volume/output route and does not request Bluetooth permission. This diagnostics app remains only as an older hardware-inspection utility.

It validates:

- USB-C or wired microphone detection
- Optional Bluetooth A2DP speaker detection for older hardware checks
- Google TTS language playback
- HID footpad/button key events
- Speaker test tone output

It does not use OpenAI keys, store raw audio, or store transcripts.

Build:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\user\AppData\Local\Android\Sdk'
.\gradlew.bat :app:assembleDebug
```
