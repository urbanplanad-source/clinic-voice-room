# Field Test Guide

## Recommended Room Pairing

Use one room link as the only handoff value. Do not ask staff to type a room ID.

1. Staff logs in to the web app and creates a room.
2. For consultation mode, scan the patient web QR code.
3. For procedure mode, scan the patient web QR code on a second device.
4. The staff device uses the doctor's wired or close microphone.
5. The patient device stays near the patient and uses its own microphone.
6. The Android spike link is only for native-app testing.

## Link Types

Patient web link:

```txt
https://clinic-voice-room-ufz4.vercel.app/room/join/{roomToken}?mode=consultation
```

Android app link:

```txt
clinicvoiceroom://room/join?token={roomToken}&mode=procedure&backend=https%3A%2F%2Fclinic-voice-room-ufz4.vercel.app
```

Procedure mode now uses the same patient web link as the primary QR. This avoids the single-device wired-headset problem where the patient cannot speak into the doctor's microphone.

## Why Token-Only Is Better

- `roomId` is an internal database ID and should stay hidden from staff.
- The token is already temporary and room-specific.
- A full join link can be pasted, scanned, or sent without extra pairing steps.
- The app can safely resolve the room ID server-side and avoid wrong-room pairing in nearby consultation rooms.

## Low-Latency Web Setup

The web version is suitable for field testing in both consultation and procedure mode when the microphone path is controlled.

- Prefer a wired USB-C/Lightning microphone, wired headset, or close tablet microphone.
- Avoid Bluetooth microphones for speech input. Bluetooth output is acceptable for testing, but input quality and latency vary heavily by device.
- Keep the active speaker within 20-40 cm of the microphone.
- Use one speaker at a time. Push-to-talk should define the direction instead of mixing both voices into one stream.
- Join the room and allow microphone permission before the real conversation starts. The app can preconnect the Realtime session after the microphone stream is ready.
- In consultation mode, use text as the primary workflow. Staff should type only. Patients should type first and use the voice button only as a fallback.
- In procedure mode, use two devices: doctor device for doctor speech, patient device for patient speech.
- The one-device procedure setup is only a fallback for one-way doctor-to-patient guidance.

## Pilot Metrics

Do not store raw audio or full transcripts by default. For field testing, record only operational metadata:

- Time from push-to-talk start to first translated text delta.
- Time from push-to-talk stop to final translated text.
- Room created, joined, ended timestamps.
- Language, mode, staff role, and anonymized room/session identifiers.
- Reconnects, token failures, microphone permission failures, and manual retries.

## Safety Notes

- Confirm numbers, dates, medication names, allergies, and procedure names on screen before acting on them.
- If voice output is delayed or unstable, continue with text-only interpretation.
- If same-language speech appears to produce no translation, treat it as a pass-through situation and repeat or show the original text.

## Procedure Latency Tuning

- Doctor-to-patient translation should show partial text as soon as the first translation delta arrives.
- In procedure mode, the app should not wait for long silence after the doctor stops speaking. A short quiet window is preferred so the patient can respond quickly.
- The patient button should remain available after doctor speech while translation is being displayed or played. Only block patient input while the doctor is actively speaking.
- For the fastest field workflow, the doctor should speak in short clinical chunks: one instruction, one warning, or one question at a time.
- In web procedure mode, a paired Bluetooth keyboard or remote can toggle push-to-talk with Space, Enter, Numpad Enter, or media play/pause.
- Bluetooth earbuds are acceptable for audio output tests, but avoid relying on their microphone for clinical input. Prefer a wired or close device microphone for the doctor's speech.
- Procedure mode should prioritize fast translated text delivery, then read that text aloud on the receiving device with local browser TTS. This is usually faster than waiting for server-generated speech.
