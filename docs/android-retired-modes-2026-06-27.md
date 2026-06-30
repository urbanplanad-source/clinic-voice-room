# Android Retired Modes Snapshot - 2026-06-27

This file preserves the Android staff-app modes removed from the visible field UI on 2026-06-27.
They were not removed from backend contracts and can be restored by re-adding their cards/buttons to the Android mode selection UI.

## Retired Visible Modes

### Consultation Room

- Mode value: `consultation`
- Backend room mode: `consultation`
- Room creation path: `/api/rooms`
- Voice upload fallback endpoint: `/api/consultation-voice-turns`
- Original large-card UI:

```kotlin
ModeLargeCard(
    metrics = metrics,
    title = "상담방 만들기",
    body = "음성 중심 AI 번역 상담",
    icon = {
        Icon(
            Icons.Outlined.ChatBubbleOutline,
            contentDescription = null,
            tint = Trust,
            modifier = Modifier.size(metrics.modeIconSize)
        )
    },
    onClick = { onRoomMode("consultation") }
)
```

### Legacy Stable Face-To-Face

- Mode value: `local_interpreter`
- Android constant: `RoomModeLocalInterpreter`
- Backend room mode: none. This is a local Android-only mode.
- Original large-card UI:

```kotlin
ModeLargeCard(
    metrics = metrics,
    title = "대면 통역",
    body = "병원폰 하나로 양방향 음성 통역",
    icon = {
        Icon(
            Icons.Outlined.Translate,
            contentDescription = null,
            tint = Mint,
            modifier = Modifier.size(metrics.modeIconSize)
        )
    },
    onClick = { onRoomMode(RoomModeLocalInterpreter) }
)
```

## Active Visible Modes After This Change

The visible Android mode order is:

1. `procedure` - 시술방
2. `local_interpreter_experimental` - displayed as 대면모드

The `local_interpreter_experimental` engine is promoted to the main face-to-face mode, but the internal mode value is intentionally kept unchanged for a minimal, reversible change.

## Restore Checklist

To restore either retired mode:

1. Re-add the desired `ModeLargeCard` in `ModeSelectionScreen`.
2. Re-add the matching `ModeChoiceButton` in `RoomPanel` if that fallback panel is still used.
3. Confirm `modeKoreanLabel`, `languageRoomTitle`, and `createRoomButtonLabel` still return the intended copy.
4. Re-run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
cd android-staff-app
.\gradlew.bat :app:compileDebugKotlin
```
