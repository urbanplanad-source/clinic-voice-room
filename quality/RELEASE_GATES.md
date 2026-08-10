# Translation quality release gates

Run these gates after the 0.3.39 design regression suite and before enabling a new quality policy or glossary pack.

1. `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` must pass.
2. `pnpm quality:evaluate <validation.jsonl>` must have no schema, duplicate-ID, or semantic-group leakage error.
3. Holdout answers remain blind during development. A release has zero deterministic preservation failures and zero critical high-risk errors in the approved holdout.
4. `pnpm quality:benchmark` must keep the 10,000-term in-memory lookup and deterministic guard under the configured p95 limit.
5. Patient-to-Korean output is released only when semantic validation passes or an exact approved verified sentence is used. Unavailable validation returns `retry_required`; it does not reach TTS.
6. Only `finalTranslation` may feed persistence, room broadcast, samples, usage success, and TTS.
7. Pack activation requires checksum and Ed25519 signature verification, an immutable version, a rollback target, and a staged hospital rollout.
8. Apply the generated database migration and activate a pack only with separate production approval.

