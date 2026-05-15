# DATA_MODEL.md

## Core Entities
- Hospital
- StaffUser
- TranslationRoom
- RoomParticipant
- UsageSession

## Relationships
- Hospital 1:N StaffUser
- Hospital 1:N TranslationRoom
- Hospital 1:N UsageSession
- StaffUser 1:N TranslationRoom
- StaffUser 1:N UsageSession
- TranslationRoom 1:1 UsageSession

See `prisma/schema.prisma` for the executable schema.
