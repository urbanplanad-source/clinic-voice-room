# Glossary governance

MediVoice glossary assets use an immutable version workflow:

1. New entries and sample promotions create a `draft` that does not affect translation.
2. A reviewer records `approved`, reviewer ID, and review time.
3. Only an approved version can become `active`; activation retires the prior active version in the same lineage.
4. Editing an active version creates a new draft version instead of overwriting production data.
5. Rolling back creates a new active version from the selected historical version, preserving the full audit chain.

The runtime glossary reads only rows where `isActive = true`; lifecycle actions keep that flag synchronized with `active`. Existing rows migrate as active version 1, so the migration does not remove current glossary behavior. Keeping the runtime query on the compatibility flag also prevents a temporary translation outage if application code and the schema migration are deployed a few minutes apart.

For a future 10,000-sentence library, PostgreSQL remains the master store. Android should ship a 300–1,000 sentence core pack and download versioned specialty packs into a local indexed database. Pre-generated audio should be limited to critical phrases; other reviewed text can use installed device TTS voices.
