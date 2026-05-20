"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2, PhoneOff, Send, Sparkles } from "lucide-react";
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
  consultationTextCopy,
  getPatientFollowUpSuggestionSet,
  getStaffFollowUpSuggestionSet,
  inferConsultationStage,
  stageLabel,
} from "@/lib/consultation-templates";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

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
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);
  const chatScrollRef = useRef<HTMLElement | null>(null);
  const isComposingTextRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const lastFetchedMessageAtRef = useRef<string | null>(null);
  const messagePollInFlightRef = useRef(false);

  const copy = consultationTextCopy[room.patientLanguage];
  const deliveryStatusCopy = role === "staff" ? { sending: "전송 중", failed: "전송 실패" } : consultationDeliveryStatusCopy[room.patientLanguage];
  const chatMessages = [...messages].reverse();
  const latestPatientMessage = messages.find((message) => message.speaker === "patient");
  const latestPatientText = latestPatientMessage?.text;
  const previousPatientMessage = messages.filter((message) => message.speaker === "patient")[1];
  const latestStaffMessage = messages.find((message) => message.speaker === "staff");
  const inferredStage = inferConsultationStage(latestPatientText, inferConsultationStage(previousPatientMessage?.text, "intake"));
  const staffSuggestionSet = getStaffFollowUpSuggestionSet(latestPatientText, inferredStage);
  const patientSuggestionSet = getPatientFollowUpSuggestionSet(latestStaffMessage?.text, room.patientLanguage);
  const canSubmitText = Boolean(textInput.trim()) && !textSubmitting && room.status !== "ended";
  const canSendExampleText = !textSubmitting && room.status !== "ended";

  const title = useMemo(() => {
    const language = languageLabels[room.patientLanguage];
    return role === "staff" ? `${language.ko} 번역상담` : `${language.native} Consultation`;
  }, [role, room.patientLanguage]);

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

  const confirmLocalMessage = useCallback((localMessageId: string, serverMessageId: string) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== localMessageId) return message;
        return { id: serverMessageId, speaker: message.speaker, text: message.text };
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
          appendMessage(message);
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

      confirmLocalMessage(localMessage.id, message.id);
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

  function sendSuggestedPatientText(example: string) {
    void submitTextMessage(example);
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-0 flex-col overflow-hidden rounded-lg bg-white shadow-soft md:min-h-[720px]">
      <header className="shrink-0 border-b border-line bg-white px-3 py-2.5 md:px-6 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-trust">{room.hospital?.name ?? "Clinic Voice Room"}</p>
            <h1 className="mt-0.5 truncate text-base font-bold text-ink md:mt-1 md:text-lg">{title}</h1>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-trust md:gap-2 md:px-3 md:py-2 md:text-xs">
            <span className="h-2 w-2 rounded-full bg-trust" />
            {room.status === "ended" ? (role === "staff" ? "종료" : copy.statusEnded) : role === "staff" ? "채팅" : copy.statusChat}
          </span>
        </div>

        {role === "staff" ? (
          <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 md:mt-2 md:items-start md:gap-3 md:px-3 md:py-2.5">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green-100 text-[10px] font-bold text-mint md:h-8 md:w-8 md:text-xs">AI</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-ink md:text-sm">텍스트 번역 상담이 시작되었습니다.</p>
              <p className="hidden text-xs font-semibold leading-5 text-slate-500 md:mt-0.5 md:block">상담 단계와 추천문구로 흐름을 정리하세요.</p>
            </div>
          </div>
        ) : (
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{copy.chatStarted}</p>
        )}

        {role === "staff" ? (
          <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1.5 text-[11px] font-bold text-mint md:mt-2 md:gap-2 md:px-3 md:py-2 md:text-xs">
            <Sparkles size={14} />
            <span className="truncate">AI가 고객 메시지에 맞춰 다음 질문을 추천합니다.</span>
          </div>
        ) : null}
      </header>

      <section ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-mist px-3 py-3 md:px-6 md:py-4" aria-live="polite">
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
          <div className="flex h-full min-h-[180px] items-center justify-center text-center md:min-h-[260px]">
            <div>
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-green-100 text-sm font-bold text-mint md:h-14 md:w-14 md:text-lg">AI</div>
              <p className="mt-3 text-sm font-bold text-ink md:mt-4 md:text-base">{role === "staff" ? "고객의 메시지가 여기에 표시됩니다." : copy.title}</p>
              <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-500 md:mt-2 md:text-sm md:leading-6">{role === "staff" ? "고객 응답에 맞춰 안내하세요." : copy.empty}</p>
            </div>
          </div>
        )}
      </section>

      <footer className="shrink-0 border-t border-line bg-white px-2.5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 md:px-4 md:pb-4">
        {role === "patient" ? (
          <div className="mb-2 rounded-2xl bg-blue-50 p-2.5">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-trust shadow-sm">
                <Sparkles size={15} />
              </span>
              <div>
                <p className="text-xs font-bold text-trust">{patientSuggestionSet.label}</p>
                <p className="text-[11px] font-semibold text-slate-500">{latestStaffMessage ? copy.placeholder : copy.empty}</p>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {patientSuggestionSet.suggestions.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => sendSuggestedPatientText(example)}
                  disabled={!canSendExampleText}
                  className="min-w-[190px] rounded-lg bg-white px-2.5 py-1.5 text-left text-xs font-bold leading-4 text-ink shadow-sm transition hover:bg-slate-50 disabled:opacity-50 md:min-w-[230px]"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : latestPatientMessage ? (
          <div className="mb-2 rounded-2xl bg-slate-50 p-2.5 md:p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-100 text-trust md:h-8 md:w-8">
                  <Sparkles size={15} />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink md:text-sm">AI 추천 질문</p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-500 md:text-xs">
                    {staffSuggestionSet.label} · {stageLabel(inferredStage)}
                  </p>
                </div>
              </div>
              <span className="hidden rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 shadow-sm sm:inline-flex">
                고객 답변에 따라 자동 변경
              </span>
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 md:mt-3 md:grid md:grid-cols-2 md:gap-2 md:overflow-visible md:pb-0">
              {staffSuggestionSet.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setTextInput(suggestion)}
                  className="min-h-10 min-w-[220px] rounded-xl bg-white px-3 py-2 text-left text-xs font-bold leading-4 text-ink shadow-sm transition hover:bg-blue-50 hover:text-trust md:min-h-12 md:min-w-0 md:text-sm md:leading-5"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-2xl bg-slate-50 p-1.5 md:p-2">
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
            className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-3 py-1.5 text-base font-semibold leading-7 text-ink outline-none disabled:opacity-60 md:max-h-28 md:min-h-11 md:py-2"
          />
          <button
            type="button"
            onClick={() => void submitTextMessage()}
            disabled={!canSubmitText}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-trust text-white transition hover:bg-blue-600 disabled:opacity-50 md:h-11 md:w-11"
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
            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-rose-50 px-4 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 md:mt-3 md:h-11 md:text-sm"
          >
            {ending ? <Loader2 size={17} className="animate-spin" /> : <PhoneOff size={17} />}
            상담 종료
          </button>
        ) : null}
      </footer>
    </div>
  );
}
