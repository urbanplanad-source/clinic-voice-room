# MediVoice Play Store translation-quality candidate report

Generated: 2026-08-12

## Verdict

- Candidate status: **device and staged-server verification required**
- Web regression: 48 files / 289 tests passed
- ESLint: 0 errors, 1 unrelated pre-existing warning
- Next.js production build: passed
- Android official verification: passed (debug/field unit tests, compile, test APK, field lint)
- No commit, push, Vercel deployment, database migration, or production environment change was performed.

## Improvements made

1. Korean and English clinic-brand aliases now compare through canonical brand IDs.
2. Rejuran color-box terms remain input-recognition aliases, while output uses official identifiers such as Rejuran HB.
3. Korean stop requests translated as English stop requests no longer fail a generic negation check.
4. Stop/refusal preservation is now a separate hard deterministic gate.
5. Cantonese question, negation, and stop signals and selected multilingual stop signals were added.
6. A semantic pass may override only lexical question/negation parity. It cannot override number, clinical unit, target language, brand, or stop/refusal failures.
7. Main translation remains gpt-5.5. Local semantic validation is configured separately as gpt-5.4-mini.

## Objective evidence

### Free synthetic deterministic audit

The 300 references are synthetic and unapproved, so failures are candidates for review rather than ground-truth defects.

- Initial pass: 188 / 300 (62.67%)
- After first targeted fixes: 204 / 300 (68.00%)
- Current pass: 236 / 300 (78.67%)
- Brand mismatch candidates: 15 -> 5 -> 0
- Question-form mismatch candidates: 11 -> 1
- Remaining candidates: negation 40, number 23, stop/refusal 4, clinical unit 3, question 1; overlaps exist.

### Paid 10-case smoke comparison

- Original gpt-5.5 translation + gpt-5.5 validation: 3 pass, 3 blocked, 4 unavailable.
- Independent high-reasoning review: translation quality passed 10 / 10; seven correct outputs were blocked.
- After initial deterministic fixes, same-model rerun: 4 pass, 2 blocked, 4 unavailable.
- gpt-5.5 translation + gpt-5.4-mini validation: 9 pass, 1 blocked.
- The remaining blocked Ultherapy Prime case was traced to normalized Korean input 울쎄라피 프라임 and fixed.
- Final targeted first-three check after that fix: 3 / 3 pass. One transient provider timeout was resumed successfully.
- Mini-validator semantic latency in the 10-case comparison: average 1,920 ms, min 1,276 ms, max 2,970 ms.

## Cost ledger

- Historical 300-case live evaluation actual estimate: USD 12.713395
- Historical independent adjudication actual estimate: USD 3.927560
- New smoke and adjudication actual estimate: USD 0.710990
- Same-model rerun actual estimate: USD 0.393525
- Mini-validator smoke actual estimate: USD 0.407100
- Final targeted-three actual estimate: USD 0.113960
- Total priced estimate: **USD 18.266530**
- Timeout/unpriced upper-bound exposure: **USD 7.123960**
- Conservative combined exposure: **USD 25.390490**

The unpriced exposure is a reservation-style upper bound for calls whose token usage was unavailable, not confirmed billing. Further paid calls are stopped until actual provider billing is reconciled.

## Release gates still open

1. Add OPENAI_TEXT_TRANSLATION_MODEL_LIGHT=gpt-5.4-mini to the staged Vercel environment and deploy a preview/staged server.
2. Re-run the final 30 spoken cases on a connected Android phone against that staged server.
3. Confirm screen text and TTS input are identical to the final validated translation.
4. Record retry count, auto-stop failures, STT transcript, final translation, and end-to-end latency.
5. Human-review remaining critical/high-risk failures and approve only verified corrections.
6. Reconcile actual OpenAI billing before any additional paid 100/300-case expansion.

## User decision point

The next external-state action is a staged Vercel environment update and deployment. It should be approved separately because it changes the server used by the app. Production release, Play Console upload, commit, and push remain out of scope until the 30-case device gate passes.
