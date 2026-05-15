# Android OpenAI Audio Spike Plan

## Purpose

Prove whether `gpt-realtime-translate` can produce usable translated audio on Android through the translation-specific WebRTC endpoint:

- token endpoint: `POST https://api.openai.com/v1/realtime/translations/client_secrets`
- calls endpoint: `POST https://api.openai.com/v1/realtime/translations/calls`

This spike should answer one question before any two-phone routing work starts:

Can a Kotlin Android app send microphone audio to OpenAI Realtime Translation and receive translated audio as a playable remote WebRTC audio track?

## Non-Goals

- No production Android UI.
- No LiveKit yet.
- No two-device relay yet.
- No hospital device provisioning yet.
- No glossary enforcement beyond logging observed translation quality.
- No replacement of the existing web MVP.

## Recommended Location

Current local spike project:

- `android-spike/`

It is intentionally a throwaway prototype. Promote it only after the audio path is proven.

Open `android-spike/` directly in Android Studio, not the repository root.

## Current Backend Reuse

The existing route can issue the OpenAI translation client secret:

- `POST /api/realtime/session-token`

Request body:

```json
{
  "roomId": "room_id",
  "role": "patient",
  "roomToken": "room_token"
}
```

Response shape:

```json
{
  "token": {
    "client_secret": {
      "value": "ephemeral_secret"
    },
    "expires_at": 1234567890
  }
}
```

The route also accepts `role: "staff"`, but staff requests depend on the existing web cookie session. For the first Android spike, prefer one of these:

- use `role: "patient"` with a real `roomToken`
- temporarily test through a browser-created room
- add a separate dev-only Android token route later, guarded by environment checks, if repeated staff-direction tests become painful

Do not put `OPENAI_API_KEY` in the Android app.

## Spike App Screen

One screen is enough.

Fields:

- Backend base URL
- Room ID
- Room token
- Role selector: `staff` or `patient`
- Patient language selector for notes, though actual language comes from the room

Controls:

- Request token
- Connect WebRTC
- Start microphone
- Stop microphone
- Disconnect
- Clear logs

Indicators:

- token fetched
- peer connection state
- ICE connection state
- data channel state
- local microphone track enabled
- remote audio track received
- remote audio track unmuted
- first transcript delta time
- first translated audio time

Logs:

- timestamped client events
- raw server data-channel event types
- transcript deltas and done events
- errors
- audio route changes

## Android Permissions And Settings

Required permission:

- `android.permission.RECORD_AUDIO`

Recommended for spike:

- keep screen awake while connected
- request audio focus during active call
- set communication audio mode during capture/playback
- log current audio route

Later product app permissions may need foreground service declarations, but the first spike should stay minimal unless the OS kills the session during testing.

## Kotlin Dependencies

Likely candidates:

- AndroidX AppCompat or Jetpack Compose for the single screen
- OkHttp for HTTP token request and SDP exchange
- `io.github.webrtc-sdk:android` for the `org.webrtc` PeerConnection classes

Do not add LiveKit to this spike. That belongs to the second phase.

## WebRTC Flow

```mermaid
sequenceDiagram
    participant A as Android spike app
    participant B as Existing Next.js backend
    participant O as OpenAI Realtime Translation

    A->>B: POST /api/realtime/session-token
    B-->>A: ephemeral client secret
    A->>A: create PeerConnection
    A->>A: add microphone audio track
    A->>A: create data channel oai-events
    A->>A: create SDP offer
    A->>O: POST /v1/realtime/translations/calls with offer SDP
    O-->>A: answer SDP
    A->>A: set remote description
    O-->>A: remote translated audio track?
    O-->>A: data channel transcript events
```

## SDP Exchange

HTTP request:

```http
POST https://api.openai.com/v1/realtime/translations/calls
Authorization: Bearer EPHEMERAL_CLIENT_SECRET
Content-Type: application/sdp

v=0
...
```

Expected response:

```http
HTTP/1.1 200 OK
Content-Type: application/sdp

v=0
...
```

The Android app should set the response body as the remote SDP answer.

## PeerConnection Checklist

Create and log:

- `PeerConnectionFactory`
- audio source
- local audio track
- local media stream or transceiver
- `PeerConnection`
- data channel named `oai-events`
- SDP offer
- local description set result
- HTTP answer response status
- remote description set result

Observe and log:

- `onIceConnectionChange`
- `onConnectionChange`
- `onSignalingChange`
- `onTrack`
- `onAddTrack`
- data channel `onOpen`
- data channel `onMessage`
- remote audio track `enabled`
- remote audio track state changes if exposed by the SDK

## What Counts As Success

Minimum pass:

- Android microphone audio reaches OpenAI.
- Data channel receives transcript events.
- Android receives a remote audio track.
- Translated audio is audible on the same Android device.

Strong pass:

- first translated audio is heard before a separate `/api/tts` request would usually complete
- Japanese produces audible translated speech, not only text
- reconnect works after disconnect
- 10 minutes of repeated utterances does not degrade
- wired earphone microphone input works
- phone speaker output works

## Test Matrix

### Direction

| Test | Role | Source speech | Expected output |
| --- | --- | --- | --- |
| D1 | staff | Korean | patient language audio |
| P1 | patient | patient language | Korean audio |

If staff auth is inconvenient in the first pass, begin with patient-direction tests and then add a dev-only staff token path.

### Languages

| Language | Priority | Pass condition |
| --- | --- | --- |
| `ja` | P0 | audible Japanese or Korean output depending on role |
| `zh` | P0 | audible Mandarin or Korean output depending on role |
| `en` | P0 | audible English or Korean output depending on role |
| `ru` | P1 | audible Russian or Korean output depending on role |
| `vi` | P1 | audible Vietnamese or Korean output depending on role |
| `id` | P1 | audible Indonesian or Korean output depending on role |

Japanese is P0 because the web MVP observed frequent text-to-audio handoff issues in Japanese mode.

### Audio Hardware

| Hardware | Pass condition |
| --- | --- |
| built-in mic + speaker | baseline audio works |
| wired earphone mic + speaker | doctor procedure setup can be simulated |
| Bluetooth headset | optional, useful but not required for first pass |

## Latency Measurements

Log these timestamps:

- `t0_capture_start`: microphone track enabled
- `t1_speech_start`: tester begins phrase, manual button is acceptable
- `t2_speech_end`: tester ends phrase, manual button is acceptable
- `t3_first_transcript_delta`: first transcript or translation event received
- `t4_transcript_done`: final transcript event received
- `t5_remote_track_received`: `onTrack` or equivalent fires
- `t6_first_audio_heard`: tester taps a button when audio is first heard

Calculate:

- speech-end to first transcript: `t3 - t2`
- speech-end to transcript done: `t4 - t2`
- speech-end to first audio heard: `t6 - t2`
- first transcript to first audio heard: `t6 - t3`

Target:

- short procedural phrases should usually feel like 1 to 3 seconds from speech end to first translated audio

Use simple phrases first:

- Korean to Japanese: use a short Korean phrase meaning "It may sting. Please do not move."
- Korean to Chinese: use a short Korean phrase meaning "I will apply cold gel now."
- Korean to English: "Please stay still for a moment."

## Event Log Checklist

Capture raw event `type` values from the data channel.

Known web MVP event handling currently watches:

- `session.output_transcript.delta`
- `session.output_transcript.done`
- `error`

The Android spike should not assume those are the only events. Log every event type exactly as received.

## Expected Findings

The spike should produce one of these outcomes:

### Outcome A: Audio Track Works

Proceed to the two-device routing spike.

Recommended next step:

- LiveKit/SFU experiment with an AI translation worker

### Outcome B: Text Works But Audio Track Does Not

Do not proceed to full Android product build yet.

Investigate:

- whether translation-specific sessions require a different SDP setup
- whether output audio is disabled by default
- whether generic Realtime supports the needed translation behavior better
- whether TTS fallback must remain part of the first app release

### Outcome C: Neither Text Nor Audio Works Reliably

Stop and debug the endpoint contract before any app architecture work.

Check:

- token shape
- bearer token extraction
- SDP content type
- model availability
- role/language session config
- Android WebRTC dependency behavior
- tunnel/backend reachability

## Backend Changes To Avoid At First

Avoid changing the production room schema or auth model just for the spike.

Acceptable temporary additions later:

- `POST /api/dev/realtime/session-token` in development only
- explicit Android diagnostic logging endpoint
- room fixture script for creating repeatable test rooms

Any dev-only endpoint must:

- require `NODE_ENV !== "production"` or a specific development secret
- never expose permanent OpenAI keys
- be removed or locked before pilot use

## Deliverables

At the end of the spike, produce:

- Android project or branch location: currently `android-spike/`
- tested device model and Android version
- language test results
- audio route test results
- measured latency table
- raw data-channel event type list
- conclusion: proceed to LiveKit/SFU spike, revise OpenAI integration, or keep TTS fallback

## Decision Gate

Proceed to the two-device routing spike only if:

- translated audio is audible on Android
- transcript events are available for diagnostics/fallback text
- Japanese, Chinese, and English pass at least basic audio playback
- no permanent API key is exposed to Android

If those are true, the next task is `ANDROID_LIVEKIT_SPIKE_PLAN.md`.
