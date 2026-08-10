# MediVoice 0.3.39 translation quality baseline

Measured on 2026-08-10 before production migration or policy activation.

## Automated evidence

- Prisma schema validation and client generation: passed.
- TypeScript typecheck: passed.
- Web tests: 39 files, 187 tests passed.
- ESLint: 0 errors; one pre-existing unused-variable warning in `scripts/analyze-plastic-v2.mjs`.
- Next.js production build: passed; 45 static pages generated.
- Android verification: debug and field unit tests, debug Android test APK, and field lint passed (`86` Gradle tasks; `3` executed and `83` up-to-date).
- Synthetic quality-path benchmark: 10,000 glossary terms, 1,000 iterations; compile `32.287 ms`, lookup plus deterministic guard p50 `0.023 ms`, p95 `0.046 ms`, p99 `0.106 ms` on this workstation.
- Source-to-GitHub-Desktop mirror: all synchronized files had identical SHA-256 hashes.

## Safety behavior now covered

- Patient-to-Korean Realtime and upload fallback turns require semantic confirmation.
- Validator unavailability returns `retry_required`; an unverified strict model translation does not reach persistence or TTS.
- Exact approved verified sentences bypass the semantic model and remain on the fast path.
- The same final value feeds message persistence, room broadcast, learning samples, API response, and downstream TTS.
- Deterministic checks cover language direction, speech act, negation, numbers, units, amounts, and contextual medical risk.
- Translation samples and feedback are redacted and hashed before persistence.
- Hospital glossary lifecycle actions enforce role and medical-sensitivity policy and write audit events.
- Immutable glossary snapshots use compiled exact-match/trie indexes and expose matched entry IDs for diagnostics.
- Download-pack primitives include SHA-256 integrity and Ed25519 authenticity verification.

## Not claimed by this baseline

- No production database migration was applied.
- No glossary pack was activated or distributed to Android.
- No signed field/release APK was created because release signing secrets were not supplied.
- No live OpenAI model, production traffic, browser device, microphone, or medical human-review acceptance test was run.
- Holdout quality rates remain unavailable until approved blind golden data is supplied.

