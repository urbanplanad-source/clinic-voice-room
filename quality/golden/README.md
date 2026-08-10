# MediVoice translation quality datasets

Store one JSON object per line with: `id`, `semanticGroupId`, `split`, `specialty`, `direction`, `sourceLanguage`, `targetLanguage`, `sourceText`, `expectedTranslation`, `candidateTranslation`, `riskTags`, and `humanApproved`.

Rules:

- Keep every spoken or spelling variant of one meaning under the same `semanticGroupId` and in one split only.
- Use `training` for glossary, prompt, and rule work; `validation` for development comparison; `holdout` only for release decisions; and `production_replay` for deidentified operating regressions.
- Do not commit patient identifiers or raw production transcripts.
- Keep blind holdout answers outside the repository under `quality/golden/private/`.
- Run `pnpm quality:evaluate <file.jsonl>` before using a dataset.
