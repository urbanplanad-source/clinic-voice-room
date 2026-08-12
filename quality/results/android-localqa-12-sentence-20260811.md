# MediVoice Android localQa 12-sentence assessment

Date: 2026-08-11
Build: 0.3.39-localqa
Direction: Korean staff to English patient
Transport: Android Realtime

## Outcome

- Pass: 1/12
- Review: 7/12
- Fail: 4/12
- Result-ready latency: p50 1160 ms, p95 1277 ms, min 950 ms, max 1331 ms
- All 12 events reported `validationStatus=not_required`.
- Korean Realtime transcription prompt reported `prompt_not_supported`.

## Sentence results

| # | Status | Observed Korean | Observed English | Finding |
|---:|---|---|---|---|
| 1 | review | 병중인 한약과 건강 보조제를 모두 말씀해 주세요. | Please list all the herbal medicines and health supplements you’re currently taking. | `복용 중인` was transcribed as `병중인`; target meaning survived. |
| 2 | pass | 사용할 약침의 성분과 제품명을 확인하겠습니다. | I'm going to confirm the ingredients and product name for the pharmacopuncture injection we'll be using. | Meaning and medical term preserved. |
| 3 | review | 특정 약제에 알레르기가 있나요? | Do you have any allergies to specific medicinal ingredients? | `약재` displayed as `약제`; target meaning survived. |
| 4 | review | 삼아지에프렉스의 600샷으로 진행하겠습니다. | We'll proceed with six hundred shots of Thermage FLX. | Korean brand display failed; target brand and amount survived, but Arabic numeral form did not. |
| 5 | review | 울산의 프라임은 오른쪽에 300샷과 왼쪽에 300샷입니다. | For Ultherapy Prime, it’s three hundred shots on the right side and three hundred shots on the left side. | Korean brand display failed; side and amount meanings survived. |
| 6 | fail | 레주란 HB ECC를 눈밑에 주입합니다. | Injecting 2 cc of Rejuran Red Box under the eyes. | `2cc` became `ECC` in STT and `HB` became `Red Box` in translation. |
| 7 | review | 리쥬 스킨부스터 시술이 맞나요? | Is this the Re2O skin booster procedure? | Korean brand display failed; target question and brand survived. |
| 8 | fail | 상처가 벌어지거나 고름과 심해지는 붉어짐이 있으면 병원에 연락하세요. | If the wound opens up or the redness worsens and there’s swelling, please contact the clinic. | Omitted pus and invented swelling. |
| 9 | fail | 피어싱, 렌즈, 의치, 보청기는 안내에 따라 제거하세요. | Please remove any piercings, contact lenses, or hearing aids according to the instructions. | Omitted dentures. |
| 10 | review | 하루에 두 번 5ml씩 복용하지 마세요. | Do not take 5 milliliters twice a day. | Dose and negation meaning survived; Arabic numeral/canonical unit form changed. |
| 11 | review | 도형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다. | I will only note the manufacturer or model name of the implant based on verified records. | `보형물` displayed as `도형물`; target meaning survived. |
| 12 | fail | 갑작스러운 호흡 곤란이나 의식 변화가 있으면 즉시 119에 연락하세요. | If you experience sudden difficulty breathing or any change in consciousness, call 911 immediately. | Emergency number changed from Korean 119 to 911. |

## Release blockers

1. Android Realtime did not apply the Korean STT prompt, so correctness must not depend on that prompt.
2. Deterministic/semantic validation was skipped for every turn, including numbers, dose, negation, lists, and emergency instructions.
3. The database is missing metric/sample columns including `messageId` and `sourceTextHash`, causing metric 500 responses and sample-write failures.
4. Final display, TTS, samples, and metrics cannot yet be proven to share the same validated final value for these turns.

## Recommended next correction

1. Run deterministic source normalization for every completed Korean transcript before display/TTS.
2. Force validation when a turn contains digits, dose/unit, negation, emergency number, medical list, or known ambiguity context.
3. Add exact full-context corrections for the observed approved variants; do not add global word replacements.
4. Add list-item preservation and Korean emergency-number preservation checks.
5. Apply the pending database migration only after review, then rerun the same 12 sentences with auditable QA capture.

## Remediation implemented

Implementation date: 2026-08-11

- Added exact full-context Android STT correction for the seven observed Korean variants. Partial words and unrelated sentences are not replaced.
- Added the same approved variants to server transcription safety.
- Added reviewed English verified-sentence fallbacks for all 12 QA sentences.
- Forced pre-output validation for:
  - an approved STT correction,
  - numeric preservation,
  - negation,
  - emergency semantics,
  - multi-item medical lists.
- Added deterministic numeric validation for non-money clinical counts and doses.
- Extended English number parsing so six hundred equals 600 and repeated three hundred equals repeated 300.
- When a verified alias matches, the Android display receives the canonical Korean source and the reviewed final translation.
- Existing priority remains hospital DB > code fallback; hospital-specific terminology is not overwritten.
- Realtime output audio remains disabled for this Android path. Android TTS starts only after validation and uses the final corrected translation.

## Verification after remediation

- Web tests: 253/253 passed.
- Targeted translation-safety tests: 61/61 passed.
- TypeScript typecheck: passed.
- ESLint: passed with one pre-existing warning in scripts/analyze-plastic-v2.mjs.
- Next.js production build: passed.
- Android localQa unit tests: 41/41 passed.
- Android localQa APK build: passed.
- Android localQa lint: passed.
- Installed on device R3CX109B2LZ:
  - package: com.clinicvoiceroom.staff.localqa
  - version: 0.3.39-localqa (51)
- Local candidate server restored on port 3028 and returned HTTP 200.

## Still pending

1. Repeat the same 12 recorded sentences on the installed QA app to measure the real post-fix pass rate and p95 latency.
2. Do not deploy, commit, or push based only on unit/build and migration proof. Production and signed field APK verification remain separate gates.

## Database migration applied

Application date: 2026-08-11

- Applied after explicit user approval; no commit, push, deployment, or pack activation was performed.
- Kept the runtime `.env` connection unchanged on the Supabase transaction pooler. Migration commands used a temporary process-only 5432 session connection.
- Detected six pending Prisma history entries. Four schemas already existed from prior out-of-band changes and were reconciled only after table, index, foreign-key, and RLS checks.
- Applied the two genuinely missing migrations:
  - `20260807143000_add_glossary_lifecycle`
  - `20260810045912_add_translation_quality_foundation`
- Restored the missing active-room lookup index from the older applied migration and mapped PostgreSQL's truncated text-usage index name in `schema.prisma`.
- Final Prisma status: all 27 migrations applied; no unresolved failed migration.
- Final database-to-schema diff: no difference detected.
- Verified required quality columns, `GlossaryAuditEvent`, `GlossaryPackRelease`, and all required quality indexes.
- Verified RLS enabled and DML privileges absent for `anon` and `authenticated` on quality sample, feedback, metric, audit, and pack-release tables.
- Verified all 430 existing glossary entries have non-null lineage and lifecycle values after backfill.
