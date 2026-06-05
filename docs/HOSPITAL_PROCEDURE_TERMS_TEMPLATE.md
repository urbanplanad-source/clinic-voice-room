# Hospital Procedure Terms Template

This template defines hospital-specific procedure and product names so Clinic Voice Room can preserve exact names during consultation and procedure translation.

Use one row per display term. Keep the Korean display term as the source of truth. Add spoken variants because staff often says shortened names during live consultation.

## Required Columns

| Column | Required | Purpose | Example |
|---|---:|---|---|
| hospital_slug | yes | Stable hospital identifier | bellemon |
| term_id | yes | Stable lowercase id for this term | rejuran_healer |
| category | yes | procedure, device, product, package, body_part, aftercare | product |
| display_ko | yes | Exact Korean text to show to staff | 리쥬란 힐러 |
| spoken_ko | yes | Korean variants separated by `\|` | 리쥬란힐러\|리주란 힐러 |
| zh | recommended | Patient-facing Chinese display | 丽珠兰 Healer |
| ja | recommended | Patient-facing Japanese display | リジュランヒーラー |
| en | recommended | Patient-facing English display | Rejuran Healer |
| ru | optional | Patient-facing Russian display | Rejuran Healer |
| vi | optional | Patient-facing Vietnamese display | Rejuran Healer |
| id | optional | Patient-facing Indonesian display | Rejuran Healer |
| fr | optional | Patient-facing French display | Rejuran Healer |
| es | optional | Patient-facing Spanish display | Rejuran Healer |
| de | optional | Patient-facing German display | Rejuran Healer |
| it | optional | Patient-facing Italian display | Rejuran Healer |
| pt | optional | Patient-facing Portuguese display | Rejuran Healer |
| preserve_brand | yes | `true` if brand/device name must not be translated generically | true |
| note | optional | Internal clarification | PN skin booster brand |
| active | yes | Keep old terms without deleting history | true |

## CSV Header

```csv
hospital_slug,term_id,category,display_ko,spoken_ko,zh,ja,en,ru,vi,id,fr,es,de,it,pt,preserve_brand,note,active
```

## Example Rows

```csv
bellemon,rejuran_healer,product,리쥬란 힐러,리쥬란힐러|리주란 힐러,丽珠兰 Healer,リジュランヒーラー,Rejuran Healer,Rejuran Healer,Rejuran Healer,Rejuran Healer,Rejuran Healer,Rejuran Healer,Rejuran Healer,Rejuran Healer,Rejuran Healer,true,PN skin booster brand,true
bellemon,ultherapy_prime,device,울쎄라피 프라임,울쎄라피프라임|울세라피 프라임,Ultherapy Prime,ウルセラピー プライム,Ultherapy Prime,Ultherapy Prime,Ultherapy Prime,Ultherapy Prime,Ultherapy Prime,Ultherapy Prime,Ultherapy Prime,Ultherapy Prime,Ultherapy Prime,true,HIFU lifting device,true
bellemon,botulinum_toxin,procedure,보툴리눔 톡신,보톡스|보툴리눔톡신,肉毒素注射,ボツリヌストキシン注射,botulinum toxin injection,инъекция ботулотоксина,tiêm botulinum toxin,suntikan botulinum toxin,injection de toxine botulique,inyección de toxina botulínica,Botulinumtoxin-Injektion,iniezione di tossina botulinica,injeção de toxina botulínica,false,avoid casual Botox as final Korean display,true
```

## Implementation Recommendation

For the current web MVP, keep the built-in glossary as the global fallback and add a hospital-specific layer later:

1. Add a `HospitalGlossaryTerm` table keyed by `hospitalId + termId`.
2. Load active terms for the room's hospital in `/api/translate-text` and Realtime prompt construction.
3. Apply hospital terms before the global glossary so hospital-specific display names win.
4. Keep `spoken_ko` variants separate from display names to support shorthand speech without changing the official output.
5. Use `preserve_brand=true` for brand/device/package names that should stay in Latin or clinic-approved mixed notation.

## Review Rules

- Do not translate a brand into a generic procedure unless the hospital explicitly wants that.
- Put patient-facing phrasing in each language column, not pronunciation hints.
- For paid packages, use the exact sales/display name in `display_ko` and keep medical explanation outside the term.
- If a term has legal or advertising sensitivity, mark it inactive until the hospital approves the wording.
