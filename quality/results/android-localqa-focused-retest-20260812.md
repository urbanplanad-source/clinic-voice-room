# Android local QA focused retest - 2026-08-12

## Scope

- Rejuran HB dose preservation
- Re2O question-form and brand preservation
- multi-item removal instruction preservation
- Korean emergency number 119 preservation

## Observed results

| Case | Final source | Final English | Result |
| --- | --- | --- | --- |
| Rejuran HB | 리쥬란 HB 2cc를 눈 밑에 주입합니다. | We will inject 2cc of Rejuran HB under the eyes. | pass |
| Re2O before STT prompt fix | 혹시 리쥬란 스킨부스터 시술이 맞나요? | Is this for the Rejuran skin booster treatment? | fail - STT brand substitution |
| Removal list | 피어싱, 렌즈, 의치, 보청기는 안내에 따라 제거하세요. | Remove piercings, contact lenses, dentures, and hearing aids as instructed. | pass |
| Emergency number | 갑작스러운 호흡 곤란이나 의식 변화가 있으면 즉시 119에 연락하세요. | If you experience sudden difficulty breathing or a change in consciousness, call 119 immediately. | pass |
| Re2O after STT prompt fix | Re2O 스킨부스터 시술이 맞나요? | Is this the Re2O skin booster procedure? | pass |

## Root cause and fix

- The Korean Realtime transcription prompt was 2,385 characters.
- The OpenAI client secret API rejected it because `session.audio.input.transcription.prompt` has a 1,024-character maximum.
- Compatibility fallback then issued a session without the hospital STT prompt, so `리투오` was transcribed as the competing valid brand `리쥬란`.
- The default prompt budget is now 1,024 characters.
- Re2O, Ultherapy, and Thermage mappings are prioritized.
- The fixed prompt explicitly distinguishes `Re2O (리투오/리투어)` from `리쥬란`.

## Verification evidence

- OpenAI compatibility probe: 1,200 and 2,385 characters rejected; 400 and 800 accepted.
- Actual Korean Realtime session after the fix: `applied=true`, `chars=1021`, `fallbackReason=null`.
- Final Re2O source: `혹시 Re2O 스킨부스터 시술이 맞나요?`.
- Final Re2O English and TTS value: `Is this the Re2O skin booster procedure?`.
- Targeted integrated Vitest: 69/69 passed.
- Android local QA unit test and APK build: passed before focused retest.
- Installed APK SHA-256 matched the built APK: `2ad4b42d95273e15854cb0b1ff246dc52eef5363b6e84668dc07a30bf0a0d41e`.

## Release note

The STT prompt limit and priority fix is server-side. No additional APK rebuild is required for this specific change. The prior Android safety and incomplete-transcript fixes remain in the installed local QA APK.
