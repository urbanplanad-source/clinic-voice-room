# Clinic Glossary Guide

## Purpose

Realtime translation is optimized for speed, but clinic-specific words need deterministic handling. Use the glossary for:

- Brand and device names
- Procedure names
- Shot counts and dosage-like counts
- Recovery and side-effect terms
- Aftercare instructions

## Core Rules

- Keep brand names stable.
- Do not translate brand names into generic descriptions.
- For English, write shot counts as `100 shots`, `200 shots`, `300 shots`.
- For Korean, write shot counts as `100샷`, `200샷`, `300샷`.
- Keep mixed Korean-English expressions readable for clinic staff.
- If a term is safety-critical, show it in both original and translated text.

## Examples

| Korean | English |
|---|---|
| 100샷 | 100 shots |
| 백샷 | 100 shots |
| 200샷 | 200 shots |
| 삼백샷 | 300 shots |
| 삼백오십샷 | 350 shots |
| 리쥬란 | Rejuran |
| 울쎄라피 프라임 | Ultherapy Prime |
| 세르프 | XERF |
| 보톡스 | Botox |
| 필러 | dermal filler |
| 마취크림 | numbing cream |
| 리터치 | touch-up |
| 붓기 | swelling |
| 멍 | bruising |

## Implementation

The canonical glossary lives in:

```txt
src/lib/clinic-glossary.ts
```

Final translated text is normalized before it is broadcast to the other participant. This is safer than relying on a prompt because the translation-specific realtime session may not support custom glossary instructions consistently.

## Adding Terms

Add terms as:

```ts
{ ko: "한국어 표기", en: "English display", aliases: ["optional synonym"] }
```

Use `aliases` for spacing variants, common misspellings, and brand variants.
