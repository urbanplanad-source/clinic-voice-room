# DATA_MODEL.md

## Core Entities
- Hospital
- StaffUser
- TranslationRoom
- RoomParticipant
- UsageSession
- ConsultationMessage

## Relationships
- Hospital 1:N StaffUser
- Hospital 1:N TranslationRoom
- Hospital 1:N UsageSession
- StaffUser 1:N TranslationRoom
- StaffUser 1:N UsageSession
- TranslationRoom 1:1 UsageSession
- TranslationRoom 1:N ConsultationMessage

## Room Mode
`TranslationRoom.roomMode` is the server-side source of truth for room behavior.
Use `consultation` for text-first chat rooms and `procedure` for voice-first procedure rooms.
Client URL query strings must not override the stored mode.

`TranslationRoom.lastActiveAt` is updated when a patient joins, a room state changes, a consultation message is saved, or a procedure turn completes. Stale cleanup uses this timestamp instead of `createdAt`, so long rooms stay open while they are active and inactive rooms close automatically.

Consultation messages are temporary delivery rows and are deleted immediately when a room ends or is stale-cleaned.

See `prisma/schema.prisma` for the executable schema.
