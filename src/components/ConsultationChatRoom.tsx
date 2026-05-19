"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlertTriangle, ClipboardList, Loader2, PhoneOff, Send } from "lucide-react";
import { languageLabels, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import { type RoomStatus } from "@/lib/room-state";
import {
  broadcastRoomUpdate,
  broadcastTranslationMessage,
  subscribeToRoomUpdates,
  subscribeToTranslationMessages,
  type RealtimeTranslationMessage
} from "@/lib/supabase-realtime";
import {
  consultationDeliveryStatusCopy,
  consultationExampleCategories,
  consultationStages,
  consultationTextCopy,
  getConsultationRiskFlags,
  getStaffFollowUpSuggestionSet,
  pickClinicConsultationTemplateProfile,
  stageByExampleCategory,
  stageLabel,
  type ConsultationExampleCategory,
  type ConsultationStage
} from "@/lib/consultation-templates";

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

type RoomSnapshot = {
  id: string;
  status: RoomStatus;
  patientLanguage: PatientLanguage;
  hospital?: { name: string };
};

type TranslationMessage = {
  id: string;
  speaker: ParticipantRole;
  text: string;
  createdAt?: string;
  deliveryStatus?: "sending" | "failed";
};

export function ConsultationChatRoom({
  initialRoom,
  role,
  roomToken
}: {
  initialRoom: RoomSnapshot;
  role: ParticipantRole;
  roomToken?: string;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState<TranslationMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [textSubmitting, setTextSubmitting] = useState(false);
  const [activeExampleCategory, setActiveExampleCategory] = useState<ConsultationExampleCategory>("visit");
  const [activeStage, setActiveStage] = useState<ConsultationStage>("intake");
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);
  const chatScrollRef = useRef<HTMLElement | null>(null);
  const isComposingTextRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const lastFetchedMessageAtRef = useRef<string | null>(null);
  const messagePollInFlightRef = useRef(false);

  const copy = consultationTextCopy[room.patientLanguage];
  const deliveryStatusCopy = role === "staff" ? { sending: "전송 중", failed: "전송 실패" } : consultationDeliveryStatusCopy[room.patientLanguage];
  const patientExamples = consultationExampleCategories[room.patientLanguage];
  const chatMessages = [...messages].reverse();
  const latestPatientMessage = messages.find((message) => message.speaker === "patient");
  const latestPatientText = latestPatientMessage?.text;
  const templateProfile = pickClinicConsultationTemplateProfile(room.hospital?.name);
  const riskFlags = getConsultationRiskFlags(latestPatientText);
  const staffSuggestionSet = getStaffFollowUpSuggestionSet(latestPatientText, activeStage);
  const canSubmitText = Boolean(textInput.trim()) && !textSubmitting && room.status !== "ended";
  const canSendExampleText = !textSubmitting && room.status !== "ended";

  const title = useMemo(() => {
    const language = languageLabels[room.patientLanguage];
    return role === "staff" ? `${language.ko} 번역상담` : `${language.native} Consultation`;
  }, [role, room.patientLanguage]);

  const summaryRows = useMemo(() => {
    const patientMessages = messages.filter((message) => message.speaker === "patient");
    const staffMessages = messages.filter((message) => message.speaker === "staff");
    const recentPatientText = patientMessages[0]?.text ?? "아직 고객 메시지가 없습니다.";
    return [
      { label: "현재 단계", value: stageLabel(activeStage) },
      { label: "템플릿", value: templateProfile.label },
      { label: "고객 언어", value: languageLabels[room.patientLanguage].ko },
      { label: "최근 고객 메시지", value: recentPatientText },
      { label: "확인 필요", value: riskFlags.length ? riskFlags.map((flag) => flag.label).join(", ") : "특이사항 없음" },
      { label: "상담 흐름", value: `고객 ${patientMessages.length}건 / 상담사 ${staffMessages.length}건` }
    ];
  }, [activeStage, messages, riskFlags, room.patientLanguage, templateProfile.label]);

  const appendMessage = useCallback((message: TranslationMessage) => {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current;
      return [message, ...current].slice(0, 80);
    });
  }, []);

  const updateMessageDeliveryStatus = useCallback((messageId: string, deliveryStatus?: TranslationMessage["deliveryStatus"]) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;
        if (!deliveryStatus) return { id: message.id, speaker: message.speaker, text: message.text };
        return { ...message, deliveryStatus };
      })
    );
  }, []);

  const endRoom = useCallback(async () => {
    setEnding(true);
    const response = await fetch(`/api/rooms/${room.id}/end`, { method: "POST" });
    setEnding(false);
    if (!response.ok) return;

    const data = await response.json();
    setRoom((current) => ({ ...current, ...data.room }));
    void broadcastRoomUpdate(data.room);
  }, [room.id]);

  const markActivity = useCallback(() => {
    if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    if (room.status === "ended") return;

    inactivityTimerRef.current = window.setTimeout(() => {
      if (role === "staff") {
        void endRoom();
      } else {
        setRoom((current) => ({ ...current, status: "ended" }));
      }
    }, INACTIVITY_TIMEOUT_MS);
  }, [endRoom, role, room.status]);

  useEffect(() => {
    const chatScroll = chatScrollRef.current;
    if (!chatScroll) return;

    const frame = window.requestAnimationFrame(() => {
      chatScroll.scrollTo({
        top: chatScroll.scrollHeight,
        behavior: chatMessages.length > 1 ? "smooth" : "auto"
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chatMessages.length, textSubmitting]);

  useEffect(() => {
    return subscribeToRoomUpdates(room.id, (updatedRoom) => {
      setRoom((current) => ({ ...current, ...updatedRoom }));
      markActivity();
    }) ?? undefined;
  }, [markActivity, room.id]);

  useEffect(() => {
    return subscribeToTranslationMessages(room.id, (message) => {
      if (message.speaker !== role) appendMessage(message);
      markActivity();
    }) ?? undefined;
  }, [appendMessage, markActivity, role, room.id]);

  useEffect(() => {
    async function fetchMessages() {
      if (messagePollInFlightRef.current) return;
      if (role === "patient" && !roomToken) return;

      messagePollInFlightRef.current = true;
      try {
        const params = new URLSearchParams();
        if (role === "patient" && roomToken) params.set("roomToken", roomToken);
        if (lastFetchedMessageAtRef.current) params.set("after", lastFetchedMessageAtRef.current);

        const query = params.toString();
        const response = await fetch(`/api/rooms/${room.id}/messages${query ? `?${query}` : ""}`, { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { messages?: TranslationMessage[] };
        const fetchedMessages = data.messages ?? [];
        let latestCreatedAt = lastFetchedMessageAtRef.current;

        for (const message of fetchedMessages) {
          if (message.createdAt && (!latestCreatedAt || message.createdAt > latestCreatedAt)) {
            latestCreatedAt = message.createdAt;
          }
          if (message.speaker !== role) {
            appendMessage(message);
          }
        }

        if (latestCreatedAt) lastFetchedMessageAtRef.current = latestCreatedAt;
        if (fetchedMessages.length) markActivity();
      } finally {
        messagePollInFlightRef.current = false;
      }
    }

    void fetchMessages();
    const interval = window.setInterval(() => {
      void fetchMessages();
    }, 1500);

    return () => window.clearInterval(interval);
  }, [appendMessage, markActivity, role, room.id, roomToken]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const response =
        role === "staff"
          ? await fetch(`/api/rooms/${room.id}`, { cache: "no-store" })
          : await fetch(`/api/rooms/by-token/${roomToken}`, { cache: "no-store" });
      if (!response.ok) return;

      const data = await response.json();
      setRoom((current) => ({ ...current, ...data.room }));
    }, 5000);

    return () => window.clearInterval(interval);
  }, [role, room.id, roomToken]);

  useEffect(() => {
    markActivity();
    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    };
  }, [markActivity]);

  async function submitTextMessage(textOverride?: string) {
    const sourceText = (textOverride ?? textInput).trim();
    if (!sourceText || textSubmitting || room.status === "ended") return;

    markActivity();
    setError("");
    setTextSubmitting(true);

    const messageId = `${role}-text-${Date.now()}`;
    const localMessage = {
      id: `${messageId}-local`,
      speaker: role,
      text: sourceText,
      deliveryStatus: "sending"
    } satisfies TranslationMessage;

    appendMessage(localMessage);

    try {
      const response = await fetch("/api/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          messageId,
          role,
          roomToken,
          patientLanguage: room.patientLanguage,
          text: sourceText
        })
      });
      const data = (await response.json().catch(() => null)) as {
        translatedText?: string;
        message?: RealtimeTranslationMessage & { createdAt?: string };
        error?: string;
      } | null;
      if (!response.ok || !data?.translatedText) {
        throw new Error(data?.error ?? "Text translation failed.");
      }

      const message = data.message ?? {
        id: messageId,
        speaker: role,
        text: data.translatedText
      } satisfies RealtimeTranslationMessage;

      void broadcastTranslationMessage(room.id, message);

      updateMessageDeliveryStatus(localMessage.id);
      if (!textOverride) setTextInput("");
    } catch (caught) {
      updateMessageDeliveryStatus(localMessage.id, "failed");
      setError(caught instanceof Error ? caught.message : "Text translation failed.");
    } finally {
      setTextSubmitting(false);
    }
  }

  function handleTextInputKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (isComposingTextRef.current || event.nativeEvent.isComposing) return;

    event.preventDefault();
    void submitTextMessage();
  }

  function sendExample(category: ConsultationExampleCategory, example: string) {
    setActiveStage(stageByExampleCategory[category]);
    void submitTextMessage(example);
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-[620px] flex-col overflow-hidden rounded-lg bg-white shadow-soft md:min-h-[760px]">
      <header className="shrink-0 border-b border-line bg-white px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-trust">{room.hospital?.name ?? "Clinic Voice Room"}</p>
            <h1 className="mt-1 text-lg font-bold text-ink">{title}</h1>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-trust">
            <span className="h-2 w-2 rounded-full bg-trust" />
            {room.status === "ended" ? (role === "staff" ? "종료" : copy.statusEnded) : role === "staff" ? "채팅" : copy.statusChat}
          </span>
        </div>

        <div className="mt-2 flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green-100 text-xs font-bold text-mint">AI</div>
          <div>
            <p className="text-sm font-bold text-ink">{role === "staff" ? "텍스트 번역 상담이 시작되었습니다." : copy.chatStarted}</p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">{role === "staff" ? "상담 단계와 추천문구로 흐름을 정리하세요." : copy.placeholder}</p>
          </div>
        </div>

        {role === "staff" ? (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {consultationStages.map((stage) => {
              const active = stage.id === activeStage;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveStage(stage.id)}
                  className={`min-h-8 shrink-0 rounded-lg px-3 text-xs font-bold transition ${
                    active ? "bg-trust text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {stage.shortLabel}
                </button>
              );
            })}
            <span className="inline-flex min-h-8 shrink-0 items-center rounded-lg bg-green-50 px-3 text-xs font-bold text-mint">
              {templateProfile.label}
            </span>
          </div>
        ) : null}
      </header>

      <section ref={chatScrollRef} className="flex-1 overflow-y-auto bg-mist px-4 py-4 md:px-6" aria-live="polite">
        {chatMessages.length ? (
          <div className="space-y-3">
            {chatMessages.map((message) => {
              const mine = message.speaker === role;
              const failed = message.deliveryStatus === "failed";
              return (
                <article key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine ? (
                    <div className="mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-100 text-xs font-bold text-mint">
                      {message.speaker === "staff" ? "S" : "P"}
                    </div>
                  ) : null}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm font-semibold leading-6 shadow-sm md:max-w-[70%] md:text-base ${
                      mine ? (failed ? "rounded-br-md bg-rose-500 text-white" : "rounded-br-md bg-trust text-white") : "rounded-bl-md bg-white text-ink"
                    }`}
                  >
                    {message.text}
                    {message.deliveryStatus ? (
                      <span className={`mt-1 block text-[11px] font-bold ${mine ? "text-white/80" : "text-slate-400"}`}>
                        {message.deliveryStatus === "sending" ? deliveryStatusCopy.sending : deliveryStatusCopy.failed}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-[260px] items-center justify-center text-center">
            <div>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100 text-lg font-bold text-mint">AI</div>
              <p className="mt-4 text-base font-bold text-ink">{role === "staff" ? "고객의 메시지가 여기에 표시됩니다." : copy.title}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{role === "staff" ? "상담 단계를 선택하고 고객 응답에 맞춰 안내하세요." : copy.empty}</p>
            </div>
          </div>
        )}
      </section>

      <footer className="shrink-0 border-t border-line bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-2 md:px-4 md:pb-4">
        {role === "patient" ? (
          <div className="mb-2 rounded-lg bg-blue-50 p-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {(Object.keys(patientExamples) as ConsultationExampleCategory[]).map((category) => {
                const active = category === activeExampleCategory;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveExampleCategory(category)}
                    className={`min-h-8 shrink-0 rounded-lg px-2.5 text-[11px] font-bold transition md:text-xs ${
                      active ? "bg-trust text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {patientExamples[category].label}
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
              {patientExamples[activeExampleCategory].examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => sendExample(activeExampleCategory, example)}
                  disabled={!canSendExampleText}
                  className="min-w-[190px] rounded-lg bg-white px-2.5 py-1.5 text-left text-xs font-bold leading-4 text-ink shadow-sm transition hover:bg-slate-50 disabled:opacity-50 md:min-w-[230px]"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : latestPatientMessage ? (
          <div className="mb-2 space-y-2">
            <div className="rounded-lg bg-slate-50 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-500">다음 질문 예시</p>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-trust shadow-sm">{staffSuggestionSet.label}</span>
              </div>
              <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
                {staffSuggestionSet.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setTextInput(suggestion)}
                    className="min-w-[210px] rounded-lg bg-white px-2.5 py-1.5 text-left text-xs font-bold leading-4 text-ink shadow-sm transition hover:bg-slate-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_1.2fr]">
              <div className="rounded-lg bg-amber-50 p-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                  <AlertTriangle size={14} />
                  확인 칩
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {riskFlags.length ? (
                    riskFlags.map((flag) => (
                      <span
                        key={flag.id}
                        className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                          flag.tone === "rose"
                            ? "bg-rose-100 text-rose-700"
                            : flag.tone === "blue"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {flag.label}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500">특이사항 없음</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <ClipboardList size={14} />
                  상담 요약 초안
                </div>
                <div className="mt-1.5 grid gap-1">
                  {summaryRows.slice(0, 5).map((row) => (
                    <p key={row.label} className="truncate text-[11px] font-semibold text-slate-600">
                      <span className="font-bold text-slate-800">{row.label}</span> · {row.value}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-2xl bg-slate-50 p-2">
          <textarea
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            onCompositionStart={() => {
              isComposingTextRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingTextRef.current = false;
            }}
            onKeyDown={handleTextInputKeyDown}
            placeholder={role === "staff" ? "상담 내용을 입력하세요." : copy.placeholder}
            disabled={room.status === "ended" || textSubmitting}
            rows={1}
            className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-base font-semibold leading-7 text-ink outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void submitTextMessage()}
            disabled={!canSubmitText}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-trust text-white transition hover:bg-blue-600 disabled:opacity-50"
            aria-label={role === "staff" ? "번역 보내기" : copy.submit}
            title={role === "staff" ? "번역 보내기" : copy.submit}
          >
            {textSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={19} />}
          </button>
        </div>
        {error ? <p className="mt-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {role === "staff" ? (
          <button
            onClick={endRoom}
            disabled={ending || room.status === "ended"}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-50 px-4 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
          >
            {ending ? <Loader2 size={17} className="animate-spin" /> : <PhoneOff size={17} />}
            상담 종료
          </button>
        ) : null}
      </footer>
    </div>
  );
}
