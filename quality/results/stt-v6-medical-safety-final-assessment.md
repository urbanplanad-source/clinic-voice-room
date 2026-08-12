# MediVoice v6 medical STT safety candidate assessment

## Outcome

- Candidate remains disabled by default (`MEDICAL_STT_SAFETY_CANDIDATE=off`).
- Clean real recordings: 24/24 safety pass, release gate PASS.
- Synthetic pink-noise recordings: 72/72 safety pass, zero medical-term, number, or unit failures.
- Previous v5 prompt on the same 72 noisy turns: 64/72 safety pass (88.9%).
- Offline replay of the deterministic full-context correction: all 8 previous safety failures recovered, with no global word replacement.

## Latency

- Clean paired run: p95 867ms without prompt vs 957ms with candidate prompt (+90ms), within the +300ms gate.
- Initial noisy paired run: p95 903ms vs 1364ms (+461ms), driven by clustered early-call outliers; therefore marked REVIEW rather than release-ready.
- Immediate paired recheck of the affected SNR20 set: p95 1022ms without prompt vs 827ms with candidate prompt (-195ms).
- v5 prompt length was 2378 characters; v6 is 2385 characters. The seven-character increase is not a credible source of a persistent 461ms delay.

## Runtime behavior

1. Approved full-sentence acoustic variants are corrected only when the complete context matches.
2. Global replacements such as `사용한 -> 사용할`, `고형물 -> 보형물`, and `ECC -> 2cc` are forbidden.
3. An unresolved high-risk Korean upload transcript is transcribed once more with a bounded disambiguation prompt.
4. If the retry does not confirm the medical term or dose, the API returns `retry_required` before translation persistence or TTS.
5. Android local Realtime is text-only; its validation route applies the same deterministic block before Android TTS.

## Remaining release evidence

- Test with actual hospital speech babble, reverberation, and microphone distance.
- Run a local/device pilot with the feature flag enabled before production activation.
- Keep production, database, and Android package rollout separate from this candidate evaluation.

