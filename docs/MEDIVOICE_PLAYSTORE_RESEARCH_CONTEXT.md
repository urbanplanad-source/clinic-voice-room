# MediVoice Play Store Commercialization Research Context

> Snapshot date: 2026-08-13 (Asia/Seoul)
>
> Purpose: provide an anonymized, code-audited project context to a research agent that cannot access local repositories.
>
> This is a technical inventory, not a claim of production readiness, legal compliance, Play Console approval, or successful live billing.

## 1. How to use this document

Use this document as the source of truth for the observed local implementation at the snapshot date. Do not assume access to any path listed below. Do not infer that a locally implemented or tested feature has been configured in Google Play, Supabase, Vercel, OpenAI, or production.

Classify conclusions using these labels:

- **Verified in source**: directly observed in code, schema, or checked documentation.
- **Verified locally**: a local automated command passed during this audit.
- **Implemented but externally unverified**: code exists, but Play Console, real purchase, signed Internal Testing, hosted staging, or physical-device evidence is absent.
- **Not found**: no implementation was found in the reviewed paths.
- **Decision required**: product, policy, legal, pricing, or operational decision remains open.

No credential values, API keys, purchase tokens, database passwords, patient data, audio, or full consultation transcripts are included here.

## 2. Executive summary

MediVoice is a hospital-focused interpretation system with:

- a native Android staff app;
- a Next.js web backend and staff/admin UI;
- a no-install patient web flow entered through a room-specific QR code;
- Korean-to-patient and patient-to-Korean voice translation;
- 17 patient languages;
- hospital, specialty, and global terminology support;
- deterministic and AI-assisted translation safety checks;
- local implementation of a 24-hour trial, one-trial-per-device protection, Google Play Billing, purchase verification, RTDN processing, and server-side entitlement enforcement.

The Play Store branch is not a clean continuation of the current hospital app. It is a large independent branch with extensive commercial infrastructure, but it is behind and structurally divergent from the current hospital translation-quality and UI baseline.

The most important release blocker is therefore not “add Billing from scratch.” It is:

1. reconcile the latest hospital translation-quality and UI changes into the Play Store branch without weakening its entitlement architecture;
2. prove the Billing and entitlement implementation against an isolated hosted staging environment and a signed Google Play Internal Testing artifact;
3. complete account/deletion, subscription-management, privacy, Data safety, monitoring, and store-listing requirements;
4. run multilingual physical-device and failure-mode evidence before public release.

## 3. Repository snapshot

### 3.1 Current hospital/field Git repository

- Local role: authoritative Git history for the hospital field product.
- Branch: `main`.
- HEAD: `ceacbd6048a1b6bbecc9f15fa9181c9eb371dc51` (`일부 수정`).
- Remote `origin/main`: matched HEAD during inspection.
- Android field version: `0.3.41` (`versionCode 53`) at the latest UI baseline.
- Notable recent commits:
  - `ceacbd6`: additional clinical-unit, number-guard, and translation-quality corrections;
  - `909024c`: MediVoice 0.3.41 procedure-room and field-diagnostics UI improvements;
  - `54ffc4d`: MediVoice 0.3.40 UI safety improvements;
  - `4a82dc3`: translation quality update.
- Current production domain reported and previously verified: `https://voice.insightmedi.co.kr`.

The separate development/build folder is not a valid Git checkout. It is used for local tools and signed field builds. Repository history must be read from the Git repository, and files must be selectively synchronized rather than copied wholesale.

### 3.2 Play Store repository

- Branch: `feature/play-store-launch`.
- HEAD: `5b5a0a15ad37fd18c416a494604b33e43aeffe34` (`fix: align Play Store high-risk translation policy`).
- Remote branch: `origin/feature/play-store-launch` at `3f6d16b`.
- Local branch state: one commit ahead of its remote at inspection time.
- Pre-existing untracked directories: `.agents/`, `design-system/`.
- Android application ID: `kr.co.insightmedi.medivoice`.
- Android namespace remains `com.clinicvoiceroom.staff`.
- Debug application ID adds `.playstoretest`.
- Android version in this branch: `0.3.34` (`versionCode 46`).
- `compileSdk`: 36.
- `targetSdk`: 36.
- `minSdk`: 26.
- Play Billing Library: `com.android.billingclient:billing:9.1.0`.

### 3.3 Repository divergence

The Play Store branch contains approximately 200 changed or added paths relative to its hospital-origin lineage, including Billing, entitlement, device-trial, Realtime lease, security, test, migration, and staging code. It must not be replaced by copying the hospital repository.

At the same time, a curated comparison found that all reviewed translation/UI files differed between the current hospital and Play Store repositories. Some current hospital modules were absent under the same path in the Play Store branch.

Examples requiring manual semantic reconciliation:

- `android-staff-app/app/src/main/java/com/clinicvoiceroom/staff/MainActivity.kt`
- `android-staff-app/app/src/main/java/com/clinicvoiceroom/staff/LocalTranslationValidationPolicy.kt`
- `android-staff-app/app/src/main/java/com/clinicvoiceroom/staff/MedicalTranscriptionSafety.kt` (not found at this path in Play Store branch)
- `src/lib/translation-quality.ts` (not found at this path in Play Store branch)
- `src/lib/medical-semantic-validation.ts` (not found at this path in Play Store branch)
- `src/lib/medical-transcription-safety.ts` (not found at this path in Play Store branch)
- `src/lib/clinic-glossary.ts`
- `src/lib/local-translation-validation.ts`
- `src/lib/clinical-unit-guard.ts`
- `src/lib/number-guard.ts`
- `src/app/api/local-voice-turns/validate/route.ts`
- `src/app/api/consultation-voice-turns/route.ts`
- `src/app/api/procedure-turns/route.ts`
- `src/components/PatientJoin.tsx`
- `src/components/VoiceRoom.tsx`
- `src/components/UiSafetyContracts.test.ts` (not found at this path in Play Store branch)

Absence of the same filename does not automatically prove absence of equivalent logic. The Play Store branch introduced different finalization and entitlement modules. Each quality rule must be mapped by behavior and regression test, not by blind file copying.

## 4. Current product and user flow

### 4.1 Actors

- Hospital staff: authenticated user in a hospital organization.
- Hospital administrator: manages staff and hospital-scoped assets.
- Internal administrator: reviews usage, samples, glossary, and quality assets.
- Foreign patient: no account required; joins a procedure room through QR and a short-lived room-specific web session.

### 4.2 Staff workflows

- Staff login.
- Choose patient language from 17 supported languages.
- Create a procedure QR interpretation room.
- Use native face-to-face interpretation on one Android device.
- Use staff text translation.
- Use offline/emergency verified phrases when network translation is unavailable.
- Review current room, translation, TTS, and connection state.
- End a room and copy field diagnostics.

### 4.3 Patient workflow

- Scan a temporary QR code.
- Confirm the selected language and core AI-processing notice.
- Enter without installing an app or creating an account.
- Read translated staff speech.
- In supported procedure flow, press and speak to send patient speech for translation to Korean.
- Change displayed text size.

### 4.4 Supported languages

The Prisma `PatientLanguage` enum contains:

- Simplified Chinese (`zh`)
- Cantonese (`yue`)
- Traditional Chinese (`zh_tw`)
- Japanese (`ja`)
- English (`en`)
- Russian (`ru`)
- Vietnamese (`vi`)
- Indonesian (`id`)
- Thai (`th`)
- Malay (`ms`)
- Filipino (`tl`)
- Mongolian (`mn`)
- French (`fr`)
- Spanish (`es`)
- German (`de`)
- Italian (`it`)
- Portuguese (`pt`)

The product explicitly distinguishes Simplified Chinese, Traditional Chinese, and Cantonese.

## 5. System architecture

### 5.1 Main stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Next.js Route Handlers
- PostgreSQL through Prisma 5
- Supabase Postgres as database infrastructure
- Supabase public client Broadcast intentionally disabled in the Play Store architecture
- Authenticated same-origin polling for room/message updates
- OpenAI translation and Realtime services
- Vercel Workflow for exact Realtime entitlement-expiry hangup
- Native Android/Kotlin/Jetpack Compose staff app
- Google Play Billing Library on Android
- Google Android Publisher API, authenticated RTDN, and server-side purchase verification

### 5.2 High-level request path

```text
Android staff app
  -> authenticated Next.js API
  -> server entitlement/device authorization
  -> translation or server-controlled Realtime call
  -> deterministic safety checks
  -> optional semantic validation/correction
  -> one final translation
  -> persistence of minimal usage/sample metadata
  -> Android display and TTS

Patient browser
  -> temporary QR join code
  -> short-lived HttpOnly patient room cookie
  -> authenticated room-scoped APIs
  -> translated text and supported voice-turn uploads
```

### 5.3 Realtime control

The Play Store architecture moves browser Realtime creation behind `POST /api/realtime/calls`. The server creates and immediately consumes the bounded credential, captures the provider call ID, stores a `RealtimeCallLease`, and schedules expiry/hangup through Vercel Workflow.

Under entitlement enforcement:

- legacy Android/browser token routes return `409 REALTIME_SERVER_CONTROL_REQUIRED`;
- the Android app switches to server upload-only behavior for the process session;
- provider call IDs remain server-only;
- room end and stale cleanup request immediate hangup;
- cleanup retries failed/abandoned hangups.

This is a stronger commercial control boundary than trusting an Android token or local timer.

## 6. Translation and safety architecture

### 6.1 Intended invariants

- Translate the speaker's actual utterance; do not answer the speaker.
- Preserve translation direction.
- Preserve questions as questions, commands as commands, and important negation/refusal/stop intent.
- Preserve numbers, amounts, dates, times, dose/volume units, counts, laterality, brands, and medical terms.
- Do not invent treatment recommendations, explanations, consent, contraindications, or expected replies.
- Do not expose a rejected draft through screen, TTS, samples, or final usage records.
- Use the same server-finalized text for display and TTS.

### 6.2 Hospital baseline quality controls

The current hospital product has evolved through:

- glossary and STT hinting;
- brand alias normalization and official product-name output;
- deterministic number/unit/amount checks;
- question, command, negation, refusal, and stop-intent checks;
- semantic validation using a separate text model;
- corrected-translation replacement before final output;
- incomplete-transcript gating;
- generation/call invalidation to reject stale callbacks;
- same-turn repair and sample/usage consistency.

The reported hospital model policy is:

- primary text translation: `gpt-5.5` unless overridden;
- lighter semantic validation: `gpt-5.4-mini` through a server environment variable;
- Realtime hospital path normalized to the general `gpt-realtime` family rather than the previously tested hybrid translation-model path.

Model names and defaults are deployment-sensitive and must be verified against the actual release environment before launch.

### 6.3 Play Store branch translation additions

The Play Store branch adds or changes:

- server-finalized local translations;
- upload persistence and idempotent local turn claims;
- high-risk translation policies;
- Realtime and upload finalization tests;
- entitlement checks around translation and post-processing;
- single-flight protection;
- Android transport and fallback policies;
- one atomic finalization path intended to keep translation, trial start, sample, and usage consistent.

However, the Play Store branch is not proven to contain every current hospital correction. The latest hospital `ceacbd6` number/unit/quality corrections and the 0.3.40/0.3.41 UI changes require explicit merge and regression evidence.

## 7. Authentication and tenant structure

### 7.1 Current authentication

- Staff accounts are stored in the Prisma `StaffUser` table, not Supabase Auth.
- Passwords are hashed.
- Sessions use server-issued cookies.
- `sessionVersion` supports invalidating older sessions after password reset.
- Remember-me is not enabled by default in the Play Store security notes.
- Roles: `hospital_admin`, `staff`, `internal_admin`.
- Each staff account belongs to one hospital.

### 7.2 Current tenancy

- Hospital is the principal tenant and billing/entitlement boundary.
- Rooms, usage, glossary entries, quick phrases, feedback, samples, leases, purchases, and trial device claims relate to a hospital.
- The 24-hour trial belongs to a hospital subscription, while device-fraud prevention prevents a device from obtaining another hospital's free trial.

### 7.3 Account-management gaps

No app-facing implementation was found for these phrases or flows:

- account deletion;
- membership withdrawal;
- delete account;
- manage subscription / subscription management link.

The Billing coordinator contains a Google Play subscription-center URL, but a clearly exposed end-user subscription-management flow was not found through the searched UI phrases. This requires direct UX verification and likely implementation.

The product currently assumes hospital-created staff accounts. Research must determine whether public Play users can self-register, whether a hospital is auto-created, who becomes hospital admin, and how organization ownership is verified.

## 8. Trial, entitlement, and device controls

### 8.1 Feature flags

Three server flags are independent and default to inactive unless the exact value is `on`:

- `PLAY_BILLING_ENABLED`
- `PLAY_ENTITLEMENT_ENFORCEMENT`
- `PLAY_DEVICE_LIMIT_ENABLED`

Billing activation does not implicitly activate entitlement enforcement or device limits.

### 8.2 24-hour trial

The implemented design starts the 24-hour trial only after a successful, valid server translation. It does not start on:

- app launch;
- login;
- room creation;
- QR join;
- glossary warmup;
- credential request;
- summary;
- failed translation;
- client-reported usage.

The trial transaction is designed to:

1. acquire a hospital-scoped PostgreSQL advisory transaction lock;
2. create an inactive subscription row if absent;
3. set the start/end only when both are null;
4. use one database timestamp;
5. set the end to exactly 24 hours later;
6. avoid external API calls inside the database transaction.

Concurrent successes should share one trial window rather than extend it.

### 8.3 Device trial control

- Android derives a pseudonymous 64-character lowercase hex identifier.
- The raw Android identifier is not sent as stored data.
- The client attaches it only to the configured backend origin.
- The server hashes it again with a server-only pepper.
- Only the resulting device hash is stored.
- A successful translation is the claim event.
- Reinstall/data clear is intended not to reset the device claim.
- Paid or grandfathered access bypasses the unpaid-trial claim.

The pepper becomes long-lived identity infrastructure. Loss or accidental rotation can allow repeat trials or prevent historical matching. A key-version migration plan does not yet exist.

### 8.4 One-device versus multi-device

`HospitalSubscription.maxActiveDevices` exists, but the reviewed design is strongest around one trial per device, not a complete commercial seat/device lifecycle.

Research and implementation are still required for:

- active-device registration;
- concurrent-device enforcement;
- device replacement;
- lost device recovery;
- administrator device revocation;
- staff departure;
- business seat purchase and allocation;
- device/seat audit history;
- reasonable customer-support override;
- anti-sharing controls that do not lock out legitimate hospitals.

## 9. Google Play Billing implementation

### 9.1 Android implementation found

- One reconnecting `BillingClient` abstraction.
- Exact product/base-plan/offer query.
- Purchase launch.
- Pending-purchase state handling.
- Startup/resume restore.
- Explicit restore action.
- Server submission of purchase tokens.
- No local entitlement grant based only on Android purchase callback.
- UI state and subscription card components.

### 9.2 Server implementation found

- Billing catalog endpoint.
- Purchase verify endpoint.
- Reconcile endpoint.
- RTDN endpoint.
- Android Publisher `subscriptionsv2` verification.
- Fixed package and configured product/base-plan/offer matching.
- Encrypted purchase-token storage using AES-256-GCM and a versioned key ring.
- Hashed purchase-token uniqueness and linked-token handling.
- RTDN message-ID deduplication.
- Authenticated RTDN audience/service-account checks.
- Purchase acknowledgement after valid entitlement persistence.
- Reconciliation for missed notifications and retryable acknowledgement.
- State projection for pending, active, grace, canceled, hold, paused, expired, refunded/revoked-related outcomes.

### 9.3 Billing schema found

Key models:

- `HospitalSubscription`
- `GooglePlaySubscriptionPurchase`
- `GooglePlayRtdnEvent`
- `PlayTrialDeviceClaim`

Important constraints/indexes include:

- one subscription per hospital;
- unique obfuscated account ID;
- unique `(packageName, purchaseTokenHash)`;
- unique RTDN `messageId`;
- purchase state/expiry indexes;
- acknowledgement retry index;
- linked token index;
- event processing/lease index;
- unique device hash.

### 9.4 Billing status: not externally release-ready

The repository documentation explicitly states that Billing is implemented locally behind a flag but not release-ready or externally activated.

Not verified in this audit:

- Play Console app listing ownership;
- product IDs, base plans, offers, pricing, or localization;
- actual 1-day free trial configuration in Play Console;
- service-account Android Publisher permissions;
- Pub/Sub topic and authenticated RTDN delivery;
- license testers;
- Internal Testing purchase lifecycle;
- real purchase, pending payment, cancel, grace, hold, pause, refund, revoke, expiry, restore, reinstall, or account mismatch;
- Play acknowledgement against a real purchase;
- final Play App Signing and upload-certificate match;
- production migration and secret configuration.

## 10. Subscription state model

### 10.1 Implemented subscription states

`SubscriptionStatus` contains:

- `inactive`
- `pending`
- `active`
- `in_grace_period`
- `canceled`
- `on_hold`
- `paused`
- `expired`
- `revoked`
- `grandfathered`

`GooglePlayPurchaseState` additionally contains:

- `pending_purchase_canceled`
- `unknown`

### 10.2 Implemented tiers

- `standard`
- `business`

Catalog environment keys exist for product, base plan, and offer IDs for both tiers. Actual plan benefits, seat counts, usage limits, and pricing are not finalized in the reviewed source.

### 10.3 UX contract in documentation

The planned UX distinguishes:

- trial not started;
- trial active;
- subscription active;
- grace period;
- pending/hold/pause/expired/blocked states;
- restore and purchase actions;
- grandfathered access.

The documentation requires login, logout, purchase, restore, and management access to remain available after translation is blocked. This must be proven on the actual Android UI and API flow.

## 11. Data model inventory

### 11.1 Organization and identity

- `Hospital`
- `StaffUser`
- session cookie state through `StaffUser.sessionVersion`

There is no separate `Membership` model. Staff has a direct `hospitalId`, so multi-hospital membership and one user belonging to several organizations are not modeled.

### 11.2 Billing and entitlement

- `HospitalSubscription`
- `PlayTrialDeviceClaim`
- `GooglePlaySubscriptionPurchase`
- `GooglePlayRtdnEvent`
- `RealtimeCallLease`

There is no general-purpose `Device`, `Seat`, or billing `AuditEvent` model. The current schema is sufficient for trial/purchase projection but not a full business seat/device administration product.

### 11.3 Interpretation and usage

- `TranslationRoom`
- `RoomParticipant`
- `UsageSession`
- `ConsultationMessage`
- `TranslationFeedback`
- `TranslationSample`
- `LocalInterpreterUsageTurn`
- `LocalVoiceTurnClaim`
- `TextTranslationUsage`

### 11.4 Quality assets

- `GlossaryEntry`
- `HospitalQuickPhrase`
- feedback and sample entities above

The glossary supports scopes `global`, `specialty`, and `hospital`, and types `term`, `critical_phrase`, `transcription_hint`, and `verified_sentence`.

## 12. Privacy and data handling

### 12.1 Intended minimization

- Do not store raw voice audio.
- Do not store permanent full consultation transcripts.
- Patient account is not required.
- Provider call IDs remain server-only.
- QR join moves to a short-lived HttpOnly patient-room cookie.
- Ongoing patient URL should not contain the room token.
- Legacy room-token lookup is disabled by default in production.
- Purchase tokens are encrypted; card data is not stored by the app.
- Device trial control stores a server-derived pseudonymous hash, not the raw Android identifier.

### 12.2 Known stored text

- Consultation message rows currently store plaintext `sourceText` and translated `text` until room cleanup deletes them.
- Translation samples and feedback can store source and translated text for quality review.
- Retention, redaction, lawful basis, hospital instructions, and consent wording require final policy/legal alignment.

### 12.3 Privacy/legal gaps

Repository documentation identifies the privacy page as a draft. Before release, it still needs final decisions or review for:

- legal operator/business identity;
- customer-support and privacy contact;
- exact purposes and lawful basis;
- exact retention periods and deletion rules;
- Google/OpenAI/Supabase/Vercel processing disclosure;
- overseas transfer and processor terms;
- Play purchase-token handling;
- pseudonymous device anti-fraud handling;
- Data safety answers;
- hospital data-processing terms;
- quality-sample opt-in or contractual basis;
- account and organization deletion;
- subscription cancellation and data deletion relationship;
- medical disclaimer and non-substitution language.

Legal conclusions should be reviewed by qualified counsel, particularly for Korean privacy law, overseas processing, health-related data, and hospital processor/controller roles.

## 13. Security controls observed

Implemented or documented controls include:

- permanent OpenAI secrets remain server-side;
- password hashing;
- session-version invalidation;
- authenticated staff Realtime access;
- short-lived patient session cookie;
- restricted patient/staff room snapshots;
- room-specific join code;
- Redis-backed rate-limit support;
- fail-closed rate limiting when explicitly required;
- proxy-header trust only in approved environments;
- CSP, HSTS, frame blocking, no-referrer, and Permissions-Policy headers;
- server-owned Realtime call lease and hangup;
- purchase-token encryption and hashing;
- authenticated and deduplicated RTDN;
- environment flags that require exact `on` to activate commercial enforcement.

Open security/operational questions include:

- secret/key rotation runbooks;
- purchase-token encryption-key backup and restore;
- device pepper durability and migration;
- administrator action audit trail;
- user-visible active session/device revocation;
- account deletion and data erasure workflow;
- crash/error monitoring with PII-safe scrubbing;
- penetration testing and dependency/security scanning;
- production incident response ownership.

## 14. API surface relevant to commercialization

### 14.1 Authentication and organization

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- admin staff, usage, glossary, phrase, sample, and feedback routes

### 14.2 Room and interpretation

- room create/read/join/state/end/message/read/cleanup routes
- consultation and procedure voice-turn routes
- local voice-turn, summary, usage, and validation routes
- staff and room text-translation routes
- server-controlled Realtime call create/hangup routes
- compatibility credential/session routes

### 14.3 Billing

- `GET /api/play/billing/catalog`
- `POST /api/play/billing/purchases/verify`
- authenticated scheduled/manual reconcile route
- authenticated RTDN route

No public self-signup, account-deletion, organization-transfer, device-list, device-revoke, seat-allocation, invoice, or support-ticket API was found in the reviewed API routes.

## 15. Environment-variable inventory

Only names are listed; no values were inspected or copied into this document.

### Core server

- `DATABASE_URL`
- `SESSION_SECRET`
- `OPENAI_API_KEY`
- OpenAI model-selection variables
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`

### Play commercial features

- the three feature flags described above
- standard/business product, base-plan, and offer IDs
- Google Play service-account JSON
- purchase-token key ring and active key ID
- Pub/Sub audience and service-account email
- reconcile batch size
- device ID pepper

### Reliability and operations

- Redis REST URL/token
- required-Redis rate-limit switch
- trusted-proxy switch
- legacy room-token lookup switch
- active-room and stale-room limits
- translation-sample retention days

Production values, scoping, ownership, backup, and rotation were not verified.

## 16. Build, signing, and release identity

### 16.1 Separate package decision

The Play Store documentation records an approved separate package decision:

- Play package: `kr.co.insightmedi.medivoice`
- Hospital package: `com.clinicvoiceroom.staff`

This avoids overwriting or signing-conflicting with hospital field installations.

### 16.2 Build artifacts

- Debug build uses `.playstoretest` suffix.
- Release AAB task exists.
- Branded release bundle naming exists.
- R8/resource shrinking are enabled for release/field variants.
- A separate Play App Signing enrollment and upload key are required.

### 16.3 Current release gaps

- The Play branch version `0.3.34 (46)` is behind hospital `0.3.41 (53)` and cannot be treated as the latest functional baseline.
- The actual highest Play Console version code was not inspected.
- Final upload certificate was not compared with Play Console.
- No signed Internal Testing AAB evidence was reviewed.
- Debug fallback signing must not be accepted as release evidence.

## 17. Local verification performed during this audit

### 17.1 Web/server

On the Play Store branch at `5b5a0a1`:

- `pnpm.cmd test`: **61 test files, 585 tests passed**.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd lint`: passed.
- `pnpm.cmd build`: passed.
- Next.js production build generated 48 pages and included the Workflow endpoint and Billing routes.

### 17.2 Android

- `:app:compileDebugKotlin`: compiled.
- `:app:testFieldUnitTest`: passed/up-to-date in the current checkout.
- `:app:lintField`: passed.
- `:app:assembleDebug`: passed.

One combined `:app:testDebugUnitTest` invocation reported 14 failures, all as `ClassNotFoundException` for test classes, despite compiled test class files being present. The field unit-test variant then passed. This appears to be a debug test-runner/classpath or stale-output problem, not 14 asserted business-rule failures, but it remains an unresolved build-harness defect and should be fixed before release CI is considered reliable.

### 17.3 What these results do not prove

- no production database migration was run;
- no hosted staging deployment was verified;
- no live OpenAI model call was performed in this audit;
- no physical-device microphone/TTS/network test was performed;
- no real Google Play purchase or RTDN was performed;
- no signed release AAB was uploaded;
- no Play pre-launch report was reviewed;
- no Data safety or app-review submission was completed.

## 18. Existing commercial test infrastructure

The Play Store branch includes scripts and documentation for:

- Android debug/release build;
- physical-device verification;
- Android evidence capture;
- isolated staging database preparation;
- secure local/hosted staging startup;
- exact 24-hour trial verification;
- device-trial denial verification;
- end-to-end Play Store evidence checks;
- Realtime call expiry and server hangup evidence.

This infrastructure is a strong foundation, but existence of scripts is not proof that their required staging, credentials, migrations, or devices were successfully exercised.

## 19. Product decisions already stated by the owner

- Distribution target: public Google Play app.
- Monetization: free trial followed by paid subscription.
- Desired free period: one day, not 14 days.
- Base plan concept: one active device.
- Business plan concept: additional devices and potentially additional staff.
- Patient experience should preferably remain no-install QR web.
- Pricing is not finalized.
- Translation accuracy and medical safety take priority over latency for high-risk content.
- General low-risk translation should remain fast.
- Hospital-specific terminology and STT hints are strategic product assets.

## 20. Decisions still required

### 20.1 Customer and signup model

- Can any individual create an account, or only verified hospitals/clinics?
- Does signup create a hospital tenant automatically?
- Is a business registration or hospital verification required?
- Can one user belong to several hospitals?
- Who owns a hospital tenant if the original administrator leaves?

### 20.2 Trial and conversion

- Server-managed free 24 hours without payment method, or Play free trial requiring subscription enrollment?
- Is the existing “first successful translation starts trial” policy retained?
- Does a trial cover one hospital, one account, one device, or a combination?
- What should happen when translation succeeds but Billing/catalog services are temporarily unavailable?

### 20.3 Plans and usage

- Standard monthly price.
- Business monthly price.
- Included staff accounts.
- Included active devices.
- Usage caps or fair-use policy.
- Overage behavior.
- Annual plan.
- Contract/enterprise plan outside Play.
- Existing partner hospitals and grandfathering.

### 20.4 Server and database isolation

- Share the existing production backend/database with field hospitals, or operate a separate Play production project?
- If shared, how are migrations and commercial incidents isolated from current hospitals?
- If separate, how are quality assets/glossary updates safely distributed without copying patient or operational data?

### 20.5 Support and compliance

- Legal entity and contact.
- Support hours and SLA.
- Refund and dispute process.
- Device-transfer support process.
- Account and organization deletion.
- Hospital contract and data-processing terms.
- Quality-sample retention and opt-out.

## 21. Release blockers, ordered by severity

### P0: translation-quality and UI reconciliation

- Map and merge hospital commits from `4a82dc3` through `ceacbd6` into the Play Store branch by behavior.
- Preserve Play entitlement, atomic finalization, and upload-only enforcement.
- Add cross-repository regression tests for every medical safety invariant.
- Bring the Play Android UI/version forward from 0.3.34 while retaining separate package/signing.

### P0: real Billing and entitlement evidence

- Configure Play Console app, products, base plans, offers, pricing, and localization.
- Configure service account and Android Publisher permissions.
- Configure authenticated Pub/Sub RTDN.
- Apply migrations to disposable staging first.
- Configure encryption keys, pepper, Redis, and Cron/Workflow.
- Test the full purchase lifecycle on a signed Internal Testing artifact.

### P0: account, subscription, and recovery UX

- Decide and implement signup/tenant creation or restrict onboarding to sales/admin provisioning.
- Provide subscription management/cancellation access.
- Provide account/data deletion request paths as applicable.
- Implement device listing/replacement/revocation and support override.
- Ensure blocked users can always log in, restore, manage, cancel, or request help.

### P0: privacy and policy

- Finalize privacy, terms, subscription terms, refund/cancellation, deletion, AI limitations, and processor/overseas-transfer disclosures.
- Complete Play Data safety and health/medical declarations using actual data flows.
- Verify every retention statement against code and operations.

### P1: reliability and observability

- Crash/ANR monitoring.
- PII-safe translation/entitlement failure metrics.
- RTDN/reconcile alerting.
- Workflow/hangup alerting.
- Version distribution and forced/minimum-version policy.
- Incident rollback runbooks for code, feature flags, DB migrations, and glossary/policy packs.

### P1: multilingual release gate

- Physical speech tests by language and direction.
- Noise, accent, unclear pronunciation, and device matrix.
- Numbers, amounts, dates, units, brands, negation, commands, consent/refusal, and adverse-effect sentences.
- Screen/TTS equality and latency p50/p95.
- Release only languages that meet the defined threshold; do not assume all 17 must launch simultaneously.

### P1: Play delivery

- Resolve the debug unit-test classpath defect.
- Build signed AAB.
- Verify upload certificate and Play App Signing.
- Run Play pre-launch report.
- Complete Internal and required Closed Testing.
- Define staged rollout and halt thresholds.

## 22. Recommended architecture questions for deep research

The research should use current official sources and provide dated citations for:

1. Whether MediVoice's subscription must use Google Play Billing in Korea and what alternative-billing programs are currently available.
2. Whether a one-day Play-configured free trial is supported/recommended and what disclosures are mandatory.
3. Whether a no-payment-method server trial followed by Play purchase is policy-safe and commercially preferable.
4. Exact 2026 target API, AAB, Play App Signing, testing, and developer-account requirements.
5. Data safety classification for microphone audio sent transiently to OpenAI, translation samples, device hashes, purchase tokens, and hospital account data.
6. Account-deletion obligations for admin-provisioned versus self-created staff accounts.
7. Health/medical app declarations and whether a translation-only tool falls into additional health policy scope.
8. Korean privacy and overseas-processing obligations for hospital speech translation.
9. Recommended tenant, membership, seat, and device model for standard/business/enterprise plans.
10. Recommended server/DB isolation between field hospitals and public Play customers.
11. Play subscription state handling, RTDN retry, reconciliation cadence, acknowledgement, grace, hold, pause, refund, revoke, and linked-token behavior.
12. Cost and price model based on actual current OpenAI, Vercel, Supabase, monitoring, support, refund, and Play fee inputs.
13. Launch-language strategy based on measured quality rather than marketing count.
14. Monitoring and incident-response design that avoids retaining patient speech or full consultation text.

## 23. Evidence requested from deep research

For every recommendation, provide:

- official source and date checked;
- whether it is policy, technical requirement, best practice, inference, or legal-review item;
- impact on translation accuracy;
- impact on translation latency;
- privacy/security impact;
- implementation complexity;
- recurring operational cost;
- server deployment requirement;
- Android rebuild requirement;
- database migration requirement;
- rollback method;
- release-blocking severity.

The final research should include:

1. recommended commercial product model;
2. standard/business/enterprise feature matrix;
3. recommended trial conversion model;
4. recommended subscription and entitlement state machine;
5. recommended tenant/membership/device/seat schema changes;
6. API additions;
7. policy/privacy checklist;
8. monitoring and support architecture;
9. unit economics formulas and missing input data;
10. 30/60/90-day roadmap;
11. explicit “do not build yet” list;
12. launch go/no-go gates.

## 24. Non-negotiable safety constraints

- Do not weaken the latest hospital translation safety rules to simplify Billing or reduce latency.
- Do not trust Android local subscription state as final entitlement proof.
- Do not start or extend a free trial on failed translation.
- Do not expose rejected draft translations through UI or TTS.
- Do not forward device identifiers to OpenAI, Google RTDN payload processors beyond necessity, Supabase client code, or redirects.
- Do not store raw audio or permanent full consultation transcripts by default.
- Do not use production patient/hospital data for staging or Billing lifecycle tests.
- Do not copy one repository over the other.
- Do not activate Billing, entitlement, or device flags before external evidence is complete.
- Do not call a debug-signed APK or local AAB a Play release.

## 25. Suggested research prompt preamble

Use the following text before the detailed research request:

```text
The attached MEDIVOICE_PLAYSTORE_RESEARCH_CONTEXT.md was produced from a local source-code audit. You cannot access the local repositories, so treat the attachment as the implementation snapshot.

Do not assume that a feature described as implemented has been configured or verified in Google Play, production, or a physical device. Preserve the document's distinction between verified source, local verification, externally unverified implementation, missing functionality, and open decisions.

Use current official Google, Android, OpenAI, Supabase, Vercel, and Korean government sources. Cite the direct source and the date checked. Clearly separate policy requirements, technical best practices, commercial recommendations, inferences, and items requiring legal review.

The first objective is to recommend a safe and commercially viable release architecture. Do not produce code and do not assume all 17 languages should launch at once.
```

---

End of audited context.
