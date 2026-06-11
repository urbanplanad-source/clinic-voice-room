# Glossary DB Bootstrap

## Current Source

The initial DB glossary is generated from the existing curated source in `src/lib/clinic-glossary.ts`.

It contains:

- `152` term entries
- `8` critical safety phrase entries
- `44` realtime Korean transcription hints
- `72` starter specialty term entries
- `276` total source entries

## Import Policy

The first import stores the existing source as `scope=global`.

This keeps the current app behavior intact for all hospitals and specialties. Hospital-specific or specialty-specific entries can then be added in `/admin/glossary`; those entries override the global source through the service precedence:

`hospital > specialty > global`

The starter specialty set is imported as:

- `dermatology`: acne, pigmentation, dermatitis, warts, common dermatology medications, and dermatology procedures
- `plastic_surgery`: eye surgery, nose surgery, facial contouring, fat grafting, surgical terms, anesthesia, and recovery terms

## Recommended First Run

Run migrations first because the import needs the `GlossaryEntry` table:

```bash
corepack pnpm prisma:migrate
corepack pnpm glossary:import
```

Then verify the DB source against the code source:

```bash
corepack pnpm glossary:verify
```

After verification, enable DB reads:

```env
GLOSSARY_SOURCE=db
```

## Notes

- The import script is idempotent. Running it again updates matching source entries instead of creating duplicates.
- Keep custom hospital wording in `/admin/glossary` with `scope=hospital`.
- Keep broad clinic-wide additions in `/admin/glossary` with `scope=global`.
