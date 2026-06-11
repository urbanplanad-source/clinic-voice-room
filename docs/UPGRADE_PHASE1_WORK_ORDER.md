# UPGRADE_PHASE1_WORK_ORDER.md

> Phase 1 업그레이드 작업지시서 (Codex 개발용)
> 목표: 병원 추가·용어 관리가 "코드 배포" 없이 가능한 운영 구조 전환 + 번역 품질 개선 루프 구축
> 비즈니스 전제: 본 서비스는 광고대행사 거래처 전용 무료 부가서비스(lock-in). 과금/플랜 기능은 만들지 않는다.

---

## 0. 공통 원칙 (모든 태스크 적용)

- 비저장 원칙 유지: 원본 음성, 전체 트랜스크립트, 환자 PII는 저장하지 않는다. (예외는 Task 6에 명시)
- 기존 함수 시그니처와 API 응답 형태를 유지한다. 소비처(`translate-text`, `consultation-voice-turns`, `local-voice-turns`, `procedure-turns`, `openai-realtime.ts`)가 수정 없이 동작해야 한다.
- 전환은 feature flag로 점진 적용한다. 기본값은 기존 동작.
- 태스크 1개 = PR 1개. 각 태스크의 수용 기준(AC)을 PR 설명에 체크리스트로 포함한다.
- `pnpm typecheck && pnpm lint` 통과 필수.

## 현재 구조 요약 (Codex 참고용)

- 글로서리: `src/lib/clinic-glossary.ts` — 모듈 로드 시 CSV 형태 raw string 파싱. 주요 export: `clinicGlossary`, `normalizeClinicTranslation`, `buildClinicGlossaryInstructions`, `buildClinicTranscriptionPrompt`, 내부에 `criticalShortPhrases`, `realtimeKoreanTranscriptionHints`.
- 상담 템플릿: `src/lib/consultation-templates.ts` — 진료과 프로필을 `pickClinicConsultationTemplateProfile(hospitalName)`의 **이름 문자열 매칭**으로 선택 (취약점).
- 실시간: `src/lib/supabase-realtime.ts` broadcast가 메인, `ConsultationChatRoom.tsx`에 폴링 fallback(메시지 1.5s, 룸 상태 5s)이 **채널 상태와 무관하게 상시 동작**.
- DB: Prisma — `Hospital`, `StaffUser`, `TranslationRoom`, `RoomParticipant`, `UsageSession`, `ConsultationMessage`, `LocalInterpreterUsageTurn`.

---

## Task 1 — Hospital.specialty 필드 도입 (소형, 선행 필수)

### 목표
병원 이름 문자열 매칭으로 진료과 프로필을 고르는 현재 로직을 DB 필드 기반으로 교체한다.

### 작업 내용
1. Prisma schema에 추가:
   ```prisma
   enum HospitalSpecialty {
     dermatology
     plastic_surgery
     dental
     ophthalmology
     neurology
     oriental_medicine
     general
   }
   // Hospital 모델에:
   specialty HospitalSpecialty @default(dermatology)
   ```
2. `pickClinicConsultationTemplateProfile`를 specialty 기반으로 교체. 시그니처는 `pickClinicConsultationTemplateProfile(specialty, hospitalName?)`로 확장하고, specialty가 없을 때만 기존 이름 매칭을 fallback으로 유지.
3. `/admin/staff`(AdminStaffManager) 병원 생성/수정 폼에 specialty 선택 추가. `/api/admin/staff` route에 zod 검증 추가.
4. 마이그레이션: 기존 병원 row는 이름 매칭 결과로 specialty를 1회 backfill하는 스크립트 (`scripts/backfill-hospital-specialty.ts`).

### AC
- [ ] 병원 이름에 "성형"이 없어도 specialty=plastic_surgery면 성형 프로필이 적용된다.
- [ ] 기존 병원 데이터가 backfill 후 올바른 specialty를 가진다.
- [ ] specialty 미지정 생성 시 dermatology 기본값.

---

## Task 2 — 글로서리 DB 모델 + 시드 임포트

### 목표
`clinic-glossary.ts` 하드코딩 데이터를 DB로 이관할 수 있는 스키마와 임포트 스크립트를 만든다. (이 태스크에서는 읽기 경로를 바꾸지 않는다 — 그건 Task 3)

### 작업 내용
1. Prisma 모델:
   ```prisma
   enum GlossaryScope {
     global      // 모든 병원 공통
     specialty   // 특정 진료과 공통
     hospital    // 특정 병원 전용
   }

   enum GlossaryEntryType {
     term                // 용어 (현재 clinicGlossary 항목)
     critical_phrase     // 안전 핵심 짧은 문장 (현재 criticalShortPhrases)
     transcription_hint  // STT 힌트 (현재 realtimeKoreanTranscriptionHints)
   }

   model GlossaryEntry {
     id           String             @id @default(cuid())
     scope        GlossaryScope
     specialty    HospitalSpecialty?
     hospitalId   String?
     hospital     Hospital?          @relation(fields: [hospitalId], references: [id])
     entryType    GlossaryEntryType  @default(term)
     spokenForms  String[]           // 발화 변형 (기존 spoken 배열)
     standardKo   String
     translations Json               // { zh, zh_tw, yue, ja, en, ru, vi, id, th, ... } 부분 채움 허용
     category     String?
     note         String?
     priority     Int                @default(100) // 낮을수록 instructions에 먼저 포함
     isActive     Boolean            @default(true)
     createdAt    DateTime           @default(now())
     updatedAt    DateTime           @updatedAt

     @@index([scope, specialty, isActive])
     @@index([hospitalId, isActive])
   }
   ```
2. 임포트 스크립트 `scripts/import-glossary.ts`:
   - `clinic-glossary.ts`의 `clinicGlossary` → entryType=term, scope=specialty, specialty=dermatology로 임포트 (성형 관련 카테고리는 plastic_surgery로 분류 가능하면 분류, 애매하면 dermatology).
   - `criticalShortPhrases` → entryType=critical_phrase, scope=global.
   - `realtimeKoreanTranscriptionHints` → entryType=transcription_hint, scope=specialty/dermatology. 힌트는 standardKo에 저장, translations는 빈 객체.
   - 멱등성 보장: standardKo+scope+entryType 기준 upsert. 재실행해도 중복 생성 없음.
3. `package.json`에 `"glossary:import": "tsx scripts/import-glossary.ts"` 추가.

### AC
- [ ] 임포트 후 DB row 수 = TS 파일 항목 수 (term/critical_phrase/transcription_hint 각각 일치).
- [ ] 스크립트 2회 실행 시 row 수 불변 (멱등).
- [ ] 기존 앱 동작에 변화 없음 (읽기 경로 미변경).

---

## Task 3 — 글로서리 서비스 레이어 (읽기 경로 전환)

### 목표
번역 파이프라인이 DB 글로서리를 읽도록 전환하되, env flag로 안전하게 롤백 가능하게 한다.

### 작업 내용
1. `src/lib/glossary-service.ts` 신규:
   - `getGlossaryForHospital(hospitalId, specialty)`: scope 병합 — **hospital > specialty > global** 순서로 우선. 같은 standardKo가 중복되면 상위 scope가 이긴다.
   - 인메모리 캐시 TTL 60초 (Vercel serverless 인스턴스 단위라 충분. 전역 Map + timestamp 방식, 키는 `hospitalId:specialty`).
   - DB 장애 시 기존 TS 파일 데이터로 자동 fallback + `console.error` 로깅.
2. 기존 함수의 DB 기반 버전 구현 (동일 시그니처 + 글로서리 데이터 파라미터 추가):
   - `buildClinicGlossaryInstructions(patientLanguage, entries)`
   - `normalizeClinicTranslation(text, targetLanguage, entries)`
   - `buildClinicTranscriptionPrompt(inputLanguage, hints)`
3. 소비처 5곳(`translate-text`, `consultation-voice-turns`, `local-voice-turns`, `procedure-turns`, `openai-realtime.ts` 경유 경로)을 서비스 레이어 경유로 변경. room에서 hospitalId·specialty를 가져와 전달.
4. env flag: `GLOSSARY_SOURCE=code`(기본) | `db`. code면 기존 TS 데이터 사용.
5. instructions 토큰 상한: priority 오름차순 정렬 후 직렬화 결과가 8,000자를 넘으면 잘라낸다 (critical_phrase는 항상 포함, term부터 잘림). 상한은 `GLOSSARY_INSTRUCTIONS_MAX_CHARS` env로 조정 가능.

### AC
- [ ] 시드 직후 `GLOSSARY_SOURCE=code`와 `db`에서 `buildClinicGlossaryInstructions` 출력이 동일하다 (순서 차이 제외, diff 검증 스크립트 포함).
- [ ] DB 다운 상황(연결 문자열 오류 시뮬레이션)에서 번역 API가 TS fallback으로 정상 응답한다.
- [ ] 병원 전용 항목이 specialty 공통 항목을 덮어쓴다 (단위 테스트).

---

## Task 4 — 어드민 글로서리 관리 UI

### 목표
비개발자(대행사 운영자)가 용어를 추가·수정할 수 있는 화면. 새 병원 온보딩이 "입력"으로 끝나게 한다.

### 작업 내용
1. 페이지 `/admin/glossary`:
   - `internal_admin`: 전체 scope 관리 (global/specialty/hospital 모두).
   - `hospital_admin`: 자기 병원 scope=hospital 항목만 CRUD.
   - `staff`: 접근 불가.
2. API `GET/POST/PATCH/DELETE /api/admin/glossary` (+ `/api/admin/glossary/[id]`):
   - zod 검증, 세션 role 검증 (기존 `src/lib/session.ts` 패턴 따름).
   - 필터: scope, specialty, hospitalId, entryType, category, 검색어(standardKo/spokenForms).
3. UI 기능:
   - 목록(필터+검색) / 행 인라인 수정 / 신규 추가 폼 / isActive 토글(소프트 삭제).
   - 번역 칸은 언어별 입력, **비워두면 해당 언어는 LLM 일반 번역에 맡긴다**는 안내 문구 표시.
   - CSV 내보내기/가져오기 (가져오기는 upsert, 컬럼: entryType, scope, specialty, standardKo, spokenForms(|구분), zh, zh_tw, ja, en, ru, vi, id, th, category, note, priority).
4. 수정/추가 시 glossary-service 캐시 무효화 (같은 인스턴스 내 즉시 반영, 타 인스턴스는 TTL 60초 내 반영 — 이 정도면 충분, 별도 인프라 만들지 말 것).

### AC
- [ ] hospital_admin이 타 병원 항목에 접근 시 403.
- [ ] 항목 추가 후 60초 내 해당 병원 번역 instructions에 반영된다.
- [ ] CSV 왕복(내보내기→가져오기)이 데이터 손실 없이 동작한다.

---

## Task 5 — 병원별 자주 쓰는 문장 (Quick Phrases)

### 목표
병원마다 반복되는 안내 문장을 사전 번역해 저장하고, 상담 화면에서 1탭 발송. 토큰 비용 0, 지연 0, 번역 품질 100% 보장.

> 주의: `consultation-templates.ts` 전체를 DB화하지 않는다. 내장 제안 엔진(stage 추론, follow-up 제안, 리스크 플래그)은 코드에 유지한다. 이 태스크는 "병원 커스텀 문장" 레이어만 추가한다.

### 작업 내용
1. Prisma 모델:
   ```prisma
   model HospitalQuickPhrase {
     id           String    @id @default(cuid())
     hospitalId   String
     hospital     Hospital  @relation(fields: [hospitalId], references: [id])
     stage        String?   // intake | medical | procedure | price_schedule | summary | null(전체)
     ko           String
     translations Json      // 등록 시 일괄 사전 번역 결과 캐시
     sortOrder    Int       @default(100)
     isActive     Boolean   @default(true)
     createdAt    DateTime  @default(now())
     updatedAt    DateTime  @updatedAt

     @@index([hospitalId, isActive, sortOrder])
   }
   ```
2. 등록/수정 API: `POST/PATCH /api/admin/quick-phrases` — 저장 시 서버에서 지원 전 언어로 일괄 번역(기존 translate-text 내부 로직 재사용, 글로서리 instructions 포함)하여 translations에 캐시. ko 수정 시 재번역.
3. 관리 UI: `/admin/glossary` 내 탭 또는 `/admin/quick-phrases`. hospital_admin은 자기 병원만. 번역 결과를 보여주고 **언어별 수동 수정 허용** (수동 수정값이 항상 우선).
4. 상담 화면 통합 (`ConsultationChatRoom.tsx` staff 측):
   - 입력창 위에 현재 stage 기준 quick phrase 칩 노출 (stage=null 항목은 항상).
   - 탭하면 translate-text 호출 없이 캐시된 번역으로 즉시 메시지 발송 (기존 메시지 발송 경로의 번역 단계만 스킵).

### AC
- [ ] quick phrase 발송 시 OpenAI API 호출이 발생하지 않는다.
- [ ] 환자 언어가 무엇이든 캐시된 해당 언어 번역이 전달된다 (캐시에 없는 언어면 일반 번역 경로로 fallback).
- [ ] 발송된 메시지가 일반 메시지와 동일하게 read 처리·실시간 전달된다.

---

## Task 6 — 오역 신고 (Translation Feedback)

### 목표
직원이 이상한 번역을 1탭으로 신고 → 운영자가 검토 → 글로서리 항목으로 전환. 품질 개선 루프의 시작점.

### 작업 내용
1. Prisma 모델:
   ```prisma
   enum FeedbackStatus { new reviewed fixed dismissed }

   model TranslationFeedback {
     id             String          @id @default(cuid())
     hospitalId     String
     hospital       Hospital        @relation(fields: [hospitalId], references: [id])
     roomId         String?
     sourceText     String
     translatedText String
     sourceLanguage String
     targetLanguage String
     reporterRole   String          // staff | patient
     reason         String?
     status         FeedbackStatus  @default(new)
     createdAt      DateTime        @default(now())
     reviewedAt     DateTime?

     @@index([hospitalId, status, createdAt])
   }
   ```
   > 비저장 원칙 예외: 신고된 **해당 문장 1건만** 저장한다. roomId는 참조용이며 룸 삭제와 무관하게 feedback은 유지. UI에 "환자 이름 등 개인정보가 포함된 문장은 신고하지 마세요" 안내 필수.
2. API: `POST /api/feedback` (room 참가자 검증 — staff 세션 또는 patient room session), `GET/PATCH /api/admin/feedback` (internal_admin 전체, hospital_admin 자기 병원).
3. staff UI: 각 수신/발신 메시지에 신고 버튼(아이콘) → 사유 선택(오역/용어 틀림/어색함/기타) 1탭 제출. 신고 완료 토스트.
4. admin UI: `/admin/feedback` — 목록, 상태 변경, **"글로서리 항목으로 만들기" 버튼** → 해당 sourceText/translatedText가 프리필된 글로서리 추가 폼으로 이동.

### AC
- [ ] 환자 측에서도 신고 가능 (room session 검증, 인증 불필요).
- [ ] 신고 1건이 메시지 원문·번역문·언어쌍·병원을 정확히 담는다.
- [ ] 신고→글로서리 전환 흐름이 2클릭 이내.

---

## Task 7 — 폴링 다이어트 (Realtime 헬스 기반 적응 폴링)

### 목표
Supabase broadcast가 정상일 때 불필요한 고빈도 폴링을 줄인다. 서버 부하·Vercel 함수 호출 비용 절감.

### 현재 문제
`ConsultationChatRoom.tsx`: 메시지 1.5s + 룸 상태 5s 폴링이 realtime 채널 상태와 무관하게 상시 동작. `StaffRoom.tsx`, `PatientJoin.tsx`, `VoiceRoom.tsx`도 동일 패턴 점검 필요.

### 작업 내용
1. `src/lib/supabase-realtime.ts`의 subscribe 함수들이 채널 상태(`SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`)를 콜백으로 노출하도록 확장.
2. 폴링 훅 공통화: `src/lib/use-adaptive-polling.ts` (또는 컴포넌트 내 공통 패턴):
   - 채널 healthy → 메시지 폴링 10s, 룸 상태 15s (안전망 유지).
   - 채널 unhealthy/미설정(NEXT_PUBLIC_SUPABASE_* 없음) → 현행 1.5s / 5s.
   - `document.visibilityState === "hidden"` → 폴링 중지, 복귀 시 즉시 1회 fetch 후 재개.
   - fetch 실패 연속 3회 → 지수 백오프(최대 30s).
3. 적용 대상: `ConsultationChatRoom.tsx`, `StaffRoom.tsx`, `PatientJoin.tsx`, `VoiceRoom.tsx`.

### AC
- [ ] 채널 정상 + 탭 활성 상태에서 분당 API 호출 수가 기존 대비 80% 이상 감소.
- [ ] Supabase env 미설정 환경에서 기존과 동일하게 동작 (회귀 없음).
- [ ] 채널이 끊겼다 복구되는 시나리오에서 메시지 유실 없음 (복구 시 즉시 1회 fetch).

---

## Task 8 (선택) — PTT 개선: 탭-자동종료 하이브리드

> Phase 1 필수는 아님. Task 1~7 완료 후 여유 있으면 staff 웹 절차모드에만 옵션으로 도입.

### 개념
현재: 탭(시작) → 탭(종료). 변경: **탭(시작) → 무음 감지 시 자동 종료** (수동 종료 버튼은 유지). "말 시작은 의도 표시, 끝은 기계가 감지"로 턴당 조작을 절반으로.

### 작업 내용
1. 브라우저 Web Audio `AnalyserNode` RMS 기반 경량 VAD:
   - 발화 시작 후 RMS가 임계값 미만으로 **1.2초** 지속되면 자동 commit (기존 수동 stop과 동일 경로).
   - 최소 발화 길이 0.5초 미만이면 자동 종료 무시 (오작동 방지).
   - 임계값·무음 시간은 상수로 분리 (`VAD_SILENCE_MS`, `VAD_RMS_THRESHOLD`).
2. staff UI에 토글: "자동 턴 종료" (기본 OFF, localStorage… 대신 room 세션 state로 유지).
3. 환자 측에는 적용하지 않는다 (마이크 환경 통제 불가, 오작동 리스크).

### AC
- [ ] 토글 OFF 시 기존 동작과 완전 동일.
- [ ] 시술실 소음 환경에서 발화 중 끊김이 발생하면 임계값 조정으로 해결 가능해야 함 (상수 분리 확인).

---

## 작업 순서와 의존성

```
Task 1 (specialty) ──→ Task 2 (DB 모델+시드) ──→ Task 3 (서비스 레이어) ──→ Task 4 (어드민 UI)
                                                        │
                                                        ├─→ Task 5 (Quick Phrases)  ← Task 1 이후 병렬 가능
                                                        └─→ Task 6 (오역 신고)
Task 7 (폴링 다이어트) — 독립, 언제든 병렬
Task 8 (PTT 하이브리드) — 선택, 마지막
```

권장 스프린트: ①(1+2) → ②(3) → ③(4+7 병렬) → ④(5+6 병렬) → ⑤(8 선택)

## Codex 투입 시 태스크별 시작 프롬프트

각 태스크 시작 시 이 문서 경로(`docs/UPGRADE_PHASE1_WORK_ORDER.md`)와 태스크 번호를 지정하고 아래를 덧붙일 것:

> "docs/UPGRADE_PHASE1_WORK_ORDER.md의 Task N을 구현해. 공통 원칙 섹션을 반드시 준수하고, AC를 전부 만족시켜. 기존 API 응답 형태와 함수 시그니처를 깨지 마. 작업 전에 관련 파일을 먼저 읽고 계획을 요약한 뒤 구현해. 완료 후 pnpm typecheck && pnpm lint를 실행해."
