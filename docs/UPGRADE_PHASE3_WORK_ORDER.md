# UPGRADE_PHASE3_WORK_ORDER.md

> Phase 3 업그레이드 작업지시서 (Codex 개발용) — 계획 단계, 착수 전 대표 승인 필요
> 목표: 번역 "도구"에서 병원 워크플로(문진 → 상담 → 시술 → 사후안내) 전체를 덮는 서비스로 확장
> 전제 1: **PTT(수동 턴) 방식을 유지한다.** VAD 자동 발화 감지, 자동 핑퐁 모드는 도입하지 않는다. 다른 소리가 섞이지 않는 안정성이 우선이다.
> 전제 2: 과금/플랜 기능 없음 (거래처 전용 무료 부가서비스).
> 전제 3: 태블릿 마주보기 화면은 기존 대면모드로 충족 — 본 문서 범위 외.

---

## 0. 공통 원칙

- 비저장 원칙 유지: 원본 음성, 전체 트랜스크립트, 환자 PII 저장 금지. 룸 종속 데이터는 룸 종료/stale cleanup 시 삭제 (기존 `ConsultationMessage` 패턴 준수).
- 기존 자산 재사용 우선: 사전 번역 캐시 패턴(`quick-phrases.ts`), 검수 문장 철학(`verified-sentences.ts`), 글로서리 서비스(`glossary-service.ts`), 브로드캐스트(`supabase-realtime.ts` / `supabase-realtime-server.ts`), 가드(`number-guard`, `back-translation-check`, `guard-flags`).
- 전환은 feature flag, 기본값은 기존 동작. 태스크 1개 = PR 1개. AC를 PR 설명에 체크리스트로.
- `pnpm typecheck && pnpm lint` + 기존 `*.test.ts` 통과 필수.

## 현재 구조 참고 (Codex용)

- staff 음성(절차모드 웹): OpenAI Realtime WebRTC + `manualTurn: true`(`turn_detection: null`), `startTurn()` → `stopTurnAndTranslate()` 수동 commit. 클라이언트(`openai-realtime-client.ts`)는 이미 `conversation.item.input_audio_transcription.delta`, `response.output_text.delta` 등 **스트리밍 delta 이벤트를 수신·누적**하고 있으나 UI에 실시간 노출하지 않음.
- 환자 음성(상담모드 웹): `MediaRecorder` 단발 녹음 → `POST /api/consultation-voice-turns` 업로드 → 전사+번역. 말이 끝난 뒤에야 결과가 보임.
- TTS: `src/lib/speech.ts` — 브라우저 `speechSynthesis` (언어별 품질 편차 큼).
- 메시지 전달: DB 저장 + Supabase broadcast + 적응형 폴링 fallback (`use-adaptive-polling.ts`).

---

## Task 1 — PTT 스트리밍 자막 (Live Captions)

### 목표
PTT는 유지하되, **버튼을 누르고 있는 동안** 일어나는 일을 양쪽 화면에 실시간으로 보여준다. "눌렀는데 아무 반응이 없다가 한참 뒤 결과가 나오는" 체감 지연을 제거한다. PTT + 스트리밍은 충돌하지 않는다 — 마이크 게이트는 수동, 표시만 실시간.

### 1-A. 화자 본인 화면: 실시간 인식 자막
1. `openai-realtime-client.ts`에 콜백 추가: `onInputTranscriptDelta(partialText: string)` — 이미 누적 중인 `currentInputText`를 delta 수신 시마다 방출. `onOutputTextDelta(partialText)`도 동일하게.
2. `VoiceRoom.tsx`(절차모드 staff): PTT 활성 중 마이크 버튼 위에 인식 중 텍스트를 라이브 표시. 발화 종료 후 확정 텍스트로 교체.
3. 효과: 화자가 자기 말이 제대로 인식되는지 **말하는 도중** 확인 → 오인식이면 즉시 다시 말함. 간호사·상담직원용 도구에서 신뢰의 핵심.

### 1-B. 환자 음성 경로 업그레이드 (상담모드)
1. 환자 웹 음성을 staff와 동일한 Realtime WebRTC manualTurn 경로로 전환:
   - `/api/realtime/session-token` route가 환자 인증을 받도록 확장 — staff 세션 또는 `patient-room-session.ts` 검증 (consultation-voice-turns의 기존 이중 인증 패턴 동일 적용).
   - 환자 측도 탭(시작) → 탭(종료) PTT 그대로, 전사·번역만 스트리밍.
2. **기존 MediaRecorder 업로드 경로는 삭제하지 말고 fallback으로 유지**: WebRTC 연결 실패(구형 브라우저, 위챗 인앱 브라우저 등) 시 자동 전환. env flag `PATIENT_VOICE_TRANSPORT=upload`(기본) | `realtime`으로 점진 전환.
3. 위챗/LINE 인앱 브라우저에서 WebRTC 호환성 필드 테스트 항목을 `FIELD_TEST_GUIDE.md`에 추가할 것 (외국인 환자의 실제 진입 경로).

### 1-C. 상대방 화면: 부분 번역 고스트 버블
1. 화자 측 클라이언트가 번역 output delta를 기존 Supabase broadcast 채널에 `translation_partial` 이벤트로 전송 (300ms 스로틀, 채널 미가용 시 생략 — 폴링 환경에서는 이 기능 없이 동작).
2. 수신 측 `ConsultationChatRoom.tsx` / `VoiceRoom.tsx`: 회색 고스트 버블로 "…번역 중 텍스트" 표시 → 확정 메시지(기존 POST 경로, source of truth 불변) 도착 시 교체.
3. **가드 주의**: number-guard / back-translation-check / verified-sentence 매칭은 확정 단계에서만 동작하므로, 고스트 버블에 "번역 확인 중" 스타일(회색+이탤릭)을 명확히 적용해 확정 번역과 시각적으로 구분할 것. 가드가 번역을 수정하면 고스트와 확정 텍스트가 달라질 수 있다 — 이것이 정상 동작임을 UI가 암시해야 함.

### AC
- [ ] 화자가 말하는 도중 본인 화면에 인식 텍스트가 갱신된다 (체감 0.5초 내).
- [ ] 확정 메시지는 기존과 동일한 경로·가드·저장 방식을 거친다 (회귀 없음).
- [ ] WebRTC 불가 환경에서 환자 음성이 기존 업로드 방식으로 자동 동작한다.
- [ ] `PATIENT_VOICE_TRANSPORT=upload`에서 기존 동작과 완전 동일.

---

## Task 2 — 다국어 사전 문진 모드 (Intake)

### 목표
대기실에서 환자가 QR로 모국어 문진표를 작성하면, 상담 시작 시점에 직원 화면에 한국어 요약이 도착해 있다. 상담 시간 절반 단축 + 경쟁 번역앱이 구조적으로 못 하는 기능.

### 데이터 모델
```prisma
model IntakeTemplate {
  id         String              @id @default(cuid())
  hospitalId String?             // null이면 specialty 공통 기본 템플릿
  specialty  HospitalSpecialty?
  name       String
  isActive   Boolean             @default(true)
  questions  IntakeQuestion[]
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt
}

model IntakeQuestion {
  id           String         @id @default(cuid())
  templateId   String
  template     IntakeTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  type         String         // single | multi | text | scale | yes_no
  ko           String
  translations Json           // 사전 번역 캐시 (quick-phrases 패턴)
  options      Json?          // [{ ko, translations }] — 선택지도 사전 번역
  required     Boolean        @default(false)
  sortOrder    Int            @default(100)
}

model IntakeAnswer {
  id         String          @id @default(cuid())
  roomId     String
  room       TranslationRoom @relation(fields: [roomId], references: [id], onDelete: Cascade)
  questionId String
  // 선택형: 선택 인덱스 배열. 자유 텍스트: 원문 + 한국어 번역
  value      Json
  createdAt  DateTime        @default(now())
}
```
- `IntakeAnswer`는 **룸 종속**(`onDelete: Cascade`) — 룸 종료/stale cleanup 시 함께 삭제. 비저장 원칙 자동 충족. 별도 보존 기능을 만들지 말 것.
- 질문·선택지는 등록 시 일괄 사전 번역(LLM 초벌 + 관리 UI에서 수동 수정 가능) → 환자 응답 중 토큰 비용 0. **자유 텍스트 답변만** 제출 시 translate-text 내부 로직으로 한국어 번역.

### 플로우
1. 상담룸 생성 시 staff가 "사전 문진 포함" 토글 (기본 OFF, 병원 기본값은 admin 설정).
2. 환자 QR 입장 → 언어 선택 → (문진 ON이면) 채팅 진입 전 문진 단계: 한 문항씩 모국어로 표시, 선택지는 탭, 자유 텍스트는 입력. 건너뛰기 허용(required 제외).
3. 제출 → 직원 화면 채팅 상단에 "문진 요약 카드" 고정 표시: 질문(한국어) + 답변(한국어 번역, 자유 텍스트는 원문 병기). 시스템 메시지가 아닌 **별도 카드 UI** — `ConsultationMessage`와 섞지 않는다.
4. 환자가 문진을 건너뛰면 바로 기존 채팅 흐름.

### 관리 UI
- `/admin/intake`: 템플릿 목록/편집. specialty 기본 템플릿은 internal_admin만, 병원 템플릿은 hospital_admin 가능 (glossary 권한 패턴 동일).
- 시드: 피부과·성형외과 기본 템플릿 각 1개 (방문 목적 / 관심 시술 / 알레르기·복용약 / 임신·수유 여부 / 과거 시술 이력 / 귀국 일정). `scripts/seed-intake-templates.ts`.
- **알레르기·복용약·임신 여부 문항의 답변은 `risk-detector.ts`와 연결**: 위험 답변(예: 임신 중 + 시술 상담) 시 직원 화면 문진 카드에 리스크 칩 표시.

### AC
- [ ] 문진 OFF 룸은 기존 흐름과 완전 동일.
- [ ] 선택형 문항 응답 과정에서 OpenAI API 호출 0회.
- [ ] 룸 종료 후 `IntakeAnswer` row가 cascade 삭제된다.
- [ ] 임신/알레르기 위험 답변에 리스크 칩이 표시된다.
- [ ] 환자 언어 17종 전부에서 문진 UI 깨짐 없음 (번역 누락 언어는 영어 fallback).

---

## Task 3 — 시술 후 다국어 안내문 카드 (Aftercare)

### 목표
상담·시술 종료 시 직원이 시술명을 선택하면 환자 언어로 된 주의사항 카드를 QR/링크로 전달. 룸은 종료돼도 환자 손에 가치가 남는다.

### 핵심 설계 결정
- **안내문 본문은 LLM 실시간 생성 금지.** 사전 등록 + 운영자 검수를 거친 텍스트만 발행한다 (`verified-sentences.ts` 철학). 의료 정보 사고와 의료광고 리스크를 원천 차단하는 장치이므로 타협하지 말 것.

### 데이터 모델
```prisma
model AftercareCard {
  id            String              @id @default(cuid())
  hospitalId    String?             // null이면 specialty 공통
  specialty     HospitalSpecialty?
  procedureName String              // 예: "리쥬란 힐러", "울쎄라"
  sections      Json                // [{ heading: {ko,...}, body: {ko,...} }] 언어별 사전 번역
  isReviewed    Boolean             @default(false) // 검수 전 발행 불가
  isActive      Boolean             @default(true)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}

model AftercareIssue {
  id        String        @id @default(cuid())
  token     String        @unique // URL용 랜덤 토큰
  cardId    String
  card      AftercareCard @relation(fields: [cardId], references: [id])
  language  String        // 발행 시점 환자 언어로 고정
  hospitalId String
  createdAt DateTime      @default(now())
  expiresAt DateTime      // 기본 30일, AFTERCARE_LINK_TTL_DAYS env
}
```
- `AftercareIssue`에 환자 식별 정보 없음 — 토큰만. 룸과 독립이므로 룸 cleanup의 영향 없음. 만료 후 410 페이지.

### 플로우
1. 직원: 상담 종료 버튼 옆 "안내문 보내기" → 시술 카드 검색·선택(병원 카드 우선, specialty 공통 fallback) → 발행.
2. 환자 언어로 고정된 공개 페이지 `/aftercare/[token]` QR을 환자 화면·태블릿에 표시 → 환자 폰으로 스캔. 인증 불필요.
3. 페이지 구성: 병원명 + 시술명 + 섹션(직후 주의사항 / 24~72시간 / 일주일 / 이상 증상 시 연락) + 병원 연락처(카카오채널·위챗·LINE 링크는 Hospital 모델에 연락 채널 필드 추가).
4. 관리 UI `/admin/aftercare`: 카드 CRUD. 신규 등록 시 한국어 본문 → LLM 초벌 번역 생성 → **운영자가 언어별 검토 후 `isReviewed` 체크해야 발행 가능**. UI에 고정 경고문: "가격·이벤트·전후사진·치료효과 보장 문구를 넣지 마세요 (의료광고 심의 대상)".

### 시드
- 피부과 공통 카드 8종 초안: 리쥬란 / 쥬베룩 / 울쎄라 / 써마지 / 포텐자 / 피코레이저 / 보툴리눔 톡신 / 필러 (글로서리의 기존 용어·표기 그대로 사용). 성형외과 공통 카드는 병원 협의 후 — 시드에서 제외.
- `isReviewed=false`로 시드. 검수는 운영자(대행사)가 어드민에서 수행.

### AC
- [ ] `isReviewed=false` 카드는 발행 버튼이 비활성.
- [ ] 발행 링크에 환자 PII가 없고, 만료 후 접근 시 만료 안내 페이지.
- [ ] 발행~환자 스캔까지 직원 조작 3탭 이내.
- [ ] 카드 본문 렌더링에 LLM 호출이 없다.

---

## Task 4 (선택) — 뉴럴 TTS 업그레이드

### 목표
브라우저 `speechSynthesis`(현재 `speech.ts`)의 언어별 품질 편차 제거. 태국어·베트남어·몽골어 등에서 기계음/미지원 보이스가 신뢰를 깎는 문제 해소.

### 작업 내용
1. `POST /api/tts`: OpenAI TTS(`gpt-4o-mini-tts`)로 텍스트 → 오디오 스트림. room 참가자 인증 필수 (남용 방지), rate-limit 적용 (`rate-limit.ts` 재사용).
2. 캐시: `(sha256(text), language, voice)` 키로 오디오 캐시 — quick phrases·verified sentences·아낼 안내문처럼 반복 재생되는 텍스트는 1회 생성 후 재사용. 저장소는 Supabase Storage 또는 Vercel Blob 중 기존 인프라에 맞는 쪽 (Codex가 .env 보고 판단, 새 유료 인프라 추가 금지).
3. `speech.ts`를 어댑터 구조로: `TTS_PROVIDER=browser`(기본) | `openai`. API 실패·캐시 미스 지연 시 브라우저 TTS 자동 fallback.
4. 적용 우선순위: 절차모드 병원폰 재생(핵심 경로) → 상담모드 환자 측 재생(옵션 토글).

### AC
- [ ] `TTS_PROVIDER=browser`에서 기존 동작과 완전 동일.
- [ ] 동일 텍스트 2회 재생 시 TTS API 호출 1회 (캐시 적중).
- [ ] API 장애 시 브라우저 TTS로 끊김 없이 fallback.

---

## 작업 순서와 의존성

```
Task 1 (스트리밍 자막)  — 독립. 1-A → 1-B → 1-C 순서로 쪼개서 PR 3개 권장
Task 2 (문진)          — 독립. 사전 번역 패턴은 quick-phrases 재사용
Task 3 (안내문)        — 독립. Task 2와 어드민 패턴 공유하므로 2 다음 권장
Task 4 (TTS)           — 독립, 선택. 언제든 병렬
```

권장 스프린트: ①(1-A + 1-B) → ②(2) → ③(3 + 1-C 병렬) → ④(4 선택)

체감 효과가 가장 빠른 것은 1-A(화자 본인 라이브 자막)다 — 변경량이 가장 작은데 "반응한다"는 느낌을 만든다. 거래처 데모 효과는 Task 2(문진)가 가장 크다.

## Codex 투입용 프롬프트

> "docs/UPGRADE_PHASE3_WORK_ORDER.md의 Task N을 구현해. 공통 원칙 섹션과 전제(PTT 유지, VAD 미도입)를 반드시 준수하고, AC를 전부 만족시켜. 기존 API 응답 형태와 함수 시그니처를 깨지 마. 작업 전에 관련 파일을 먼저 읽고 계획을 요약한 뒤 구현해. 완료 후 pnpm typecheck && pnpm lint와 기존 테스트를 실행해."
