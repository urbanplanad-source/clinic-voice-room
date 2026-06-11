# UPGRADE_PHASE2_WORK_ORDER.md

> Phase 2 업그레이드 작업지시서 (Codex 개발용)
> 목표: 번역 품질·안전 — "더 잘 번역"이 아니라 **틀리면 안 되는 문장을 안 틀리게**. + API 비용 절감(모델 라우팅)
> TTS 업그레이드는 범위에서 제외 — 패드/폰의 Android TalkBack 읽기 엔진을 Google TTS로 설정하면 전 언어 안정적이므로 디바이스 설정으로 해결한다(서버 TTS 불필요).
> 전제: Phase 1(글로서리 DB화, Quick Phrases, 오역 신고, 적응형 폴링) 완료 상태에서 시작한다. 과금/플랜 기능은 만들지 않는다.

---

## 0. 공통 원칙 (모든 태스크 적용)

- **Fail-open 원칙**: 가드/검증 로직은 메시지 전달을 절대 차단하지 않는다. 실패 시 "플래그 + 경고 표시"로만 동작하고, 가드 자체의 오류(예외, 타임아웃)는 가드가 없는 것처럼 통과시킨다. 번역이 안 나가는 것이 오역보다 더 큰 사고다.
- 비저장 원칙 유지: 원본 음성, 전체 트랜스크립트, 환자 PII는 저장하지 않는다. 가드 결과 플래그는 `ConsultationMessage`에 붙는 메타데이터로만 저장한다(룸 정리 시 함께 삭제됨).
- 모든 신규 동작은 env flag로 켜고 끈다. **기본값은 OFF(기존 동작)**. 켜는 순서는 운영자가 결정한다.
- 기존 API 응답 형태는 깨지 않는다. 필드 **추가**만 허용, 변경·삭제 금지.
- 태스크 1개 = PR 1개. AC를 PR 설명에 체크리스트로 포함한다.
- `pnpm typecheck && pnpm lint` 통과 필수. 가드/파서 로직은 단위 테스트 필수 (테스트 러너가 없으면 `vitest` devDependency 추가 + `pnpm test` 스크립트 등록 — Task 2에서 1회 셋업).

## 현재 구조 요약 (Codex 참고용 — 작업 전 반드시 해당 파일을 직접 읽을 것)

- **번역 LLM 호출 지점 4곳** (모두 OpenAI Responses API, `POST https://api.openai.com/v1/responses`, 모델은 `normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL)` → 기본 `gpt-5.2`):
  1. `src/app/api/translate-text/route.ts` — 상담 텍스트 번역 (Quick Phrase 캐시 히트 시 LLM 스킵하는 분기 이미 존재 → Task 1의 매칭 분기는 이 패턴을 따른다)
  2. `src/app/api/consultation-voice-turns/route.ts` — 상담 음성: STT(`/v1/audio/transcriptions`, `gpt-4o-transcribe`) → 번역. 별도로 `handleRealtimeStaffMessage` 경로는 **클라이언트 Realtime이 이미 번역한 결과를 받아 저장만** 한다(`model: "realtime"`).
  3. `src/app/api/procedure-turns/route.ts` — 시술 모드, 2와 동일 패턴.
  4. `src/app/api/local-voice-turns/route.ts` — 로컬 통역 모드, 동일 패턴.
- 후처리: 모든 경로가 `normalizeClinicTranslation(text, targetLanguage, glossaryData)`로 critical phrase 치환을 수행 (`src/lib/clinic-glossary.ts`).
- 글로서리: `getGlossaryForHospital(hospitalId, specialty)` (`src/lib/glossary-service.ts`, 60s 캐시, hospital > specialty > global 병합). Prisma `GlossaryEntry`에 `entryType: term | critical_phrase | transcription_hint` 존재.
- 어드민: `/admin/glossary`(`AdminGlossaryManager.tsx`), `/admin/feedback`(`AdminFeedbackManager.tsx`), CSV 왕복 지원.
- 메시지: `ConsultationMessage`(speaker, sourceText, text, targetLanguage, readAt). 실시간 전달은 `src/lib/supabase-realtime.ts` broadcast + 적응형 폴링(`use-adaptive-polling.ts`).
- Next.js 15.5 (App Router) / Prisma 5 / Vercel 배포.

---

## Task 1 — 검증 문장 라이브러리 (Verified Sentences)

### 목표
부작용 설명·금기사항·동의 안내처럼 **틀리면 안 되는 문장**은 LLM 실시간 번역 대신, 사전 검수된 고정 번역문을 매칭해 그대로 내보낸다. 의료 리스크 제거 + 해당 턴 토큰 비용 0.

> Quick Phrase와의 차이: Quick Phrase는 직원이 **칩을 탭해서 고르는** 문장. Verified Sentence는 직원이 **자유롭게 입력/발화한 문장이 자동으로 매칭**되는 레이어다. 같은 문장을 두 번 등록할 필요 없도록 Task 1-5에서 연결한다.

### 작업 내용
1. Prisma: `GlossaryEntryType` enum에 `verified_sentence` 추가. 별도 모델은 만들지 않는다 — scope/specialty/hospital 3계층 병합, 어드민 CRUD, CSV, 캐시 무효화를 전부 공짜로 얻는다.
   - `spokenForms` = 매칭 대상 발화/입력 변형들, `standardKo` = 대표 한국어 문장, `translations` = 언어별 검수 번역.
2. 매칭 서비스 `src/lib/verified-sentences.ts`:
   - `normalizeForMatch(text)`: NFKC 정규화 → 공백 제거 → 문장부호 제거(`?!.,~…` 등) → 소문자화. 한국어 조사 처리 같은 형태소 분석은 **하지 않는다** (오매칭 리스크 > 미스 리스크).
   - `matchVerifiedSentence(text, patientLanguage, glossaryData)`: standardKo + spokenForms를 정규화해 **완전 일치**로 매칭. 부분 일치·유사도 매칭 금지(v1). 매칭 시 해당 언어 translations 반환, 해당 언어 번역이 비어 있으면 미스 처리(LLM 경로로).
   - 매칭 인덱스는 glossaryData 기반으로 빌드하고 glossary-service 캐시 수명에 묶는다(별도 캐시 인프라 금지).
3. 적용 지점 — LLM 호출 **직전**에 분기 (4곳 모두):
   - `translate-text`: Quick Phrase 분기 다음, LLM 호출 전. 적용 방향은 staff→patient, patient→staff 양방향(환자 발화도 spokenForms에 외국어 변형을 넣으면 매칭됨 — 단 v1 매칭 입력은 source text 그대로).
   - `consultation-voice-turns` / `procedure-turns` / `local-voice-turns`: STT 결과 텍스트로 매칭.
   - 매칭 성공 시 응답 `model: "verified"`. 이후 `normalizeClinicTranslation`은 그대로 태운다.
4. env flag: `VERIFIED_SENTENCES=off`(기본) | `on`.
5. 어드민: `AdminGlossaryManager`의 entryType 선택지·필터·CSV에 `verified_sentence` 추가. 입력 폼에 "이 문장은 등록된 번역문이 글자 그대로 나갑니다. 의학적 검수를 거친 번역만 입력하세요" 경고 문구.
6. 시드: `scripts/import-glossary.ts`에 초기 verified_sentence 시드 섹션 추가 — 피부과·성형 공통 고지 문장 30개 내외(시술 후 주의사항 고지, 금기 확인 질문, 부작용 일반 고지, 동의 확인 문장)를 scope=specialty로. **번역문은 기존 criticalShortPhrases 수준의 검수 톤을 유지하고, 새로 작성하는 번역은 PR 설명에 "운영자 검수 필요" 표시.**

### AC
- [ ] 매칭 히트 시 OpenAI API 호출이 0회다 (로그로 확인).
- [ ] "레이저 시술 후 일주일간 사우나는 피해주세요" / "레이저시술후 일주일간 사우나는 피해주세요." 처럼 공백·문장부호만 다른 입력이 동일 매칭된다.
- [ ] 등록된 번역이 없는 언어의 환자에게는 기존 LLM 경로로 동작한다.
- [ ] `VERIFIED_SENTENCES=off`에서 기존 동작과 완전 동일.
- [ ] 매칭 서비스 단위 테스트 (정규화, 히트/미스, 언어별 fallback).

---

## Task 2 — 숫자·용량 가드 (Number Guard)

### 목표
용량·횟수·날짜·금액이 들어간 문장에서 원문 숫자와 번역문 숫자를 기계 대조하고, 불일치 시 1회 재번역 → 그래도 불일치면 경고 플래그를 붙여 전달한다. 의료 통역 오역 사고 1순위가 숫자다.

### 작업 내용
1. `src/lib/number-guard.ts`:
   - `extractNumericSignature(text)`: 텍스트에서 숫자 토큰을 추출해 **정규화된 멀티셋**으로 반환.
     - 아라비아 숫자(소수·천단위 콤마 포함), 범위(`3~4회`, `2-3 days` → 3과 4 / 2와 3), 퍼센트, 금액.
     - 한국어 수사: 한자어(일·이·삼... 단위 결합: 삼일, 이주일)와 고유어(하나~열, 관형형 한/두/세/네/다섯... + 번/회/일/주/개월/시간 단위 결합), `하루`=1일, `이틀`=2일, `사흘`=3일, `반`(0.5) 정도까지. **그 이상의 희귀 수사는 파싱하지 말 것** — 파싱 못 하는 토큰은 시그니처에서 제외한다(모르는 것은 비교하지 않는다 = false positive 방지).
     - CJK 숫자(一二三十百), 전각 숫자, 태국 숫자(๐-๙)는 아라비아로 캐노니컬라이즈.
   - `compareNumericSignatures(source, translated)`: 멀티셋 비교 → `{ ok, missing: number[], extra: number[] }`. **원문에 숫자가 없으면 항상 ok** (가드 발동 자체를 안 함).
2. REST 번역 4곳에 적용 (LLM 응답 수신 직후, normalize 이전):
   - 불일치 → 같은 모델로 **1회 재시도**, instructions에 한 줄 추가: `"CRITICAL: The translation must contain exactly these numeric values: {원문 숫자 목록}. Re-translate precisely."`
   - 재시도도 불일치 → 번역문은 그대로 전달하되 플래그를 붙인다.
3. Prisma: `ConsultationMessage`에 `guardFlags Json?` 추가. 형태: `{ "numberCheck": "mismatch", "sourceNumbers": [...], "translatedNumbers": [...] }`. API 응답 message 객체에 `guardFlags` 필드 추가(기존 필드 변경 없음).
4. Realtime 경로(`handleRealtimeStaffMessage`): sourceText·translatedText가 둘 다 오므로 서버에서 가드 실행. 불일치 시 **서버에서 REST 재번역 1회** 수행 → 통과하면 그 결과로 교체, 아니면 플래그.
5. UI (`ConsultationChatRoom.tsx`, `VoiceRoom.tsx`, `StaffRoom.tsx` 중 메시지를 렌더하는 곳):
   - `guardFlags.numberCheck === "mismatch"`인 메시지에 ⚠ 배지 + "숫자 확인 필요: 원문 {sourceNumbers}" 툴팁/소형 텍스트. **직원 측에만** 표시(환자를 불안하게 하지 않는다).
6. env flag: `NUMBER_GUARD=off`(기본) | `on`.
7. 단위 테스트 셋업(vitest)과 함께 픽스처 테스트: ko↔en/zh/ja/th 각 5쌍 이상 (일치 케이스, 불일치 케이스, 고유어 수사 케이스, 범위 케이스, 숫자 없는 케이스).

### AC
- [ ] "하루 두 번, 3일간 복용하세요"의 영어 번역에서 "2"가 빠지면 감지된다.
- [ ] "一周后复诊" vs "일주일 후 재방문" (7 vs 1주: 주 단위 캐노니컬라이즈 — 주는 주끼리 비교하거나 둘 다 시그니처 제외, **둘 중 하나로 일관**)이 false positive를 내지 않는다.
- [ ] 재시도 1회 후에도 불일치면 메시지는 전달되고 guardFlags가 저장된다 (전달 차단 0건).
- [ ] 가드 내부 예외 발생 시 번역 응답이 정상 반환된다 (fail-open, try/catch 감싸기).
- [ ] `NUMBER_GUARD=off`에서 추가 API 호출·지연 0.

---

## Task 3 — 고위험 문장 역번역 검증 (Back-translation, 비동기)

### 목표
시술 동의·통증·알레르기·금기 관련 문장만 선별해 번역 결과를 한국어로 역번역 → 의미 일치를 검증한다. **메시지 전달을 늦추지 않도록 비동기**로 돌리고, 결과는 직원 화면 배지로 사후 표시한다.

### 작업 내용
1. `src/lib/risk-detector.ts`:
   - `detectHighRisk(koreanText): { isHighRisk: boolean, categories: string[] }` — 키워드 상수 배열 기반. 카테고리: consent(동의, 서명, 동의서), allergy(알레르기, 부작용 경험), contraindication(금기, 임신, 수유, 복용 중, 항응고), pain_safety(통증, 마취, 응급), dosage는 Task 2가 담당하므로 제외.
   - 키워드는 상수 export — Task 4가 재사용한다.
2. 검증 실행 — 적용 대상: **staff→patient 방향 + LLM 번역 결과만** (verified/quick_phrase/cached는 이미 신뢰됨, patient→staff는 직원이 한국어 원문을 보므로 불필요).
   - 메시지 응답 반환 후 Next 15의 `after()`(`next/server`)로 비동기 실행:
     1. 번역문 → 한국어 역번역 (light 모델, Task 4의 env 재사용: `OPENAI_TEXT_TRANSLATION_MODEL_LIGHT`, 미설정 시 표준 모델).
     2. 원문 vs 역번역문 의미 비교 — 같은 light 모델 1콜: "두 한국어 문장이 의료 상담 맥락에서 동일한 의미인가? JSON {verdict: pass|fail, reason} 만 출력" 방식.
     3. 결과를 `guardFlags`에 병합: `{ "backTranslation": { "status": "pass"|"fail"|"skipped", "backText": "...", "reason": "..." } }` + 기존 supabase broadcast로 메시지 업데이트 푸시 (broadcast 유틸이 메시지 업데이트 이벤트를 지원하지 않으면 추가, 폴링이 안전망).
   - 타임아웃 10초, 오류·타임아웃 시 `skipped` (fail-open).
   - 룸당 동시 검증 1건 제한(간단한 인메모리 가드면 충분).
3. UI (직원 측만):
   - 고위험 메시지에 상태 배지: 검증 중(스피너) → ✓(pass) / ⚠(fail) / 무표시(skipped).
   - ⚠ 탭 시: 역번역 한국어 문장 표시("환자에게는 이렇게 전달됐을 수 있습니다") + 액션 2개: "다시 번역해서 보내기"(동일 원문 재발송 경로 재사용), "오역 신고"(기존 `/api/feedback` 프리필 호출).
4. env flag: `BACK_TRANSLATION_CHECK=off`(기본) | `on`.

### AC
- [ ] 검증이 메시지 응답 시간에 영향을 주지 않는다 (응답 후 after()에서 실행).
- [ ] "보톡스 시술에 동의하시면 서명해 주세요" → 고위험 감지·검증 실행. "안녕하세요" → 실행 안 됨.
- [ ] verified_sentence·quick_phrase로 나간 메시지는 검증을 건너뛴다.
- [ ] fail 배지에서 역번역문 확인과 재번역·신고가 각각 2탭 이내.
- [ ] OpenAI 장애 시 검증은 skipped, 상담 흐름은 무영향.

---

## Task 4 — 모델 라우팅 (비용 절감)

### 목표
인사말·짧은 일상 문장은 경량 모델로, 의료 문장은 표준 모델로 라우팅해 API 비용을 30~50% 절감한다. **품질이 의심되면 무조건 표준 모델** — 절감은 보너스, 안전이 기본값.

### 작업 내용
1. `src/lib/model-router.ts`:
   - `routeTranslationModel(text, glossaryData): { tier: "light" | "standard", reason: string }`.
   - **light 조건 (전부 충족 시에만)**: ① 정규화 후 30자 이하 ② 숫자 없음(Task 2의 extractNumericSignature 재사용) ③ 고위험 키워드 없음(Task 3의 risk-detector 재사용) ④ 글로서리 term의 spokenForms/standardKo 매칭 없음. 하나라도 걸리면 standard.
2. env: `OPENAI_TEXT_TRANSLATION_MODEL_LIGHT` — **미설정이면 라우팅 전체 비활성**(전부 standard, 현재와 동일). 모델명은 운영자가 넣는다(기본값을 코드에 하드코딩하지 말 것 — OpenAI 모델 라인업은 env로만 관리).
3. 적용: REST 번역 4곳의 model 결정부를 라우터 경유로 교체. 응답의 `model` 필드에 실제 사용 모델이 그대로 노출되므로 추가 응답 변경 없음.
4. 재시도 승급: light 모델 번역이 Task 2 숫자 가드에 걸리면(이론상 ②로 차단되지만 방어적으로) 재시도는 standard 모델로.
5. 관측: 라우팅 결과를 `console.log` 구조화 로그(`[model-router] tier=light reason=...`)로 남긴다. 별도 DB 집계는 만들지 않는다(Phase 4 영역).

### AC
- [ ] "감사합니다", "잠시만 기다려주세요" → light. "리쥬란 시술 부위에 통증이 있어요" → standard (글로서리 히트).
- [ ] env 미설정 시 코드 경로가 기존과 동일 (라우터 호출은 되지만 항상 standard).
- [ ] 라우터 단위 테스트: 4가지 차단 조건 각각 검증.

---

## 작업 순서와 의존성

```
Task 1 (검증 문장)      — 독립. 가장 먼저 (리스크 제거 효과 즉시 + 가장 단순)
Task 2 (숫자 가드)      — 독립. vitest 셋업 포함
Task 3 (역번역 검증)    — Task 2의 guardFlags 컬럼·테스트 셋업에 의존 → Task 2 이후
Task 4 (모델 라우팅)    — Task 2(숫자 추출)·Task 3(risk-detector) 재사용 → Task 3 이후
```

권장 스프린트: ①(1) → ②(2) → ③(3) → ④(4)

플래그 활성화 권장 순서(운영): `VERIFIED_SENTENCES` → `NUMBER_GUARD` → `BACK_TRANSLATION_CHECK` → 모델 라우팅(LIGHT env 설정). 한 번에 하나씩 켜고 1주 관찰.

## Codex 투입 시 태스크별 시작 프롬프트

각 태스크 시작 시 이 문서 경로와 태스크 번호를 지정하고 아래를 덧붙일 것:

> "docs/UPGRADE_PHASE2_WORK_ORDER.md의 Task N을 구현해. 공통 원칙 섹션(특히 fail-open과 기본 flag OFF)을 반드시 준수하고, AC를 전부 만족시켜. 기존 API 응답 형태와 함수 시그니처를 깨지 마. 작업 전에 '현재 구조 요약'에 나온 관련 파일을 먼저 읽고 계획을 요약한 뒤 구현해. 완료 후 pnpm typecheck && pnpm lint(테스트가 있으면 pnpm test 포함)를 실행해."
