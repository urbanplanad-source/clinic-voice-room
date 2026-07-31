"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Check,
  Clipboard,
  Languages,
  Loader2,
  MessageSquareReply,
  RefreshCw,
  Trash2,
  Volume2
} from "lucide-react";
import {
  translationLanguageLabels,
  translationLanguages,
  type PatientLanguage,
  type TranslationLanguage
} from "@/lib/languages";

const maxCharacters = 3000;
const priorityTargetLanguages = [
  "zh",
  "en",
  "ja"
] as const satisfies readonly TranslationLanguage[];
const orderedLanguages = [
  "ko",
  "zh",
  "en",
  "ja",
  "zh_tw",
  "yue",
  ...translationLanguages.filter(
    (language) =>
      !["ko", "zh", "en", "ja", "zh_tw", "yue"].includes(language)
  )
] as TranslationLanguage[];

const speechLocales = {
  ko: "ko-KR",
  zh: "zh-CN",
  yue: "zh-HK",
  zh_tw: "zh-TW",
  ja: "ja-JP",
  en: "en-US",
  th: "th-TH",
  vi: "vi-VN",
  id: "id-ID",
  ms: "ms-MY",
  tl: "fil-PH",
  mn: "mn-MN",
  ru: "ru-RU",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT"
} satisfies Record<TranslationLanguage, string>;

type TranslatorResponse = {
  translatedText?: string;
  polishedSourceText?: string | null;
  error?: string;
};

type ReplySuggestionResponse = {
  suggestedReplyKo?: string;
  translatedReply?: string;
  error?: string;
};

function languageDisplay(language: TranslationLanguage) {
  const label = translationLanguageLabels[language];
  if (language === "ko") return label.ko;
  return `${label.ko} · ${label.native}`;
}

function compactLanguageDisplay(language: TranslationLanguage) {
  const label = translationLanguageLabels[language];
  if (language === "ko") return label.ko;
  return label.ko.replace("중국어 ", "중국어");
}

export function StaffTextTranslator({
  staff
}: {
  staff: { name: string; hospital: { name: string } };
}) {
  const router = useRouter();
  const [sourceLanguage, setSourceLanguage] =
    useState<TranslationLanguage>("ko");
  const [targetLanguage, setTargetLanguage] =
    useState<TranslationLanguage>("zh");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [polishedSourceText, setPolishedSourceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [suggestedReplyKo, setSuggestedReplyKo] = useState("");
  const [translatedReply, setTranslatedReply] = useState("");
  const [replySuggestionLoading, setReplySuggestionLoading] = useState(false);
  const [replySuggestionError, setReplySuggestionError] = useState("");
  const [replyCopied, setReplyCopied] = useState(false);
  const isComposingRef = useRef(false);
  const translationRequestIdRef = useRef(0);
  const replySuggestionRequestIdRef = useRef(0);

  const characters = input.length;
  const canTranslate =
    input.trim().length > 0 &&
    characters <= maxCharacters &&
    sourceLanguage !== targetLanguage &&
    !loading;
  const shouldShowPolishedSource =
    sourceLanguage === "ko" &&
    targetLanguage !== "ko" &&
    output.trim().length > 0 &&
    polishedSourceText.trim().length > 0;
  const shouldShowReplySuggestion =
    sourceLanguage !== "ko" &&
    targetLanguage === "ko" &&
    output.trim().length > 0;

  function clearReplySuggestion() {
    replySuggestionRequestIdRef.current += 1;
    setSuggestedReplyKo("");
    setTranslatedReply("");
    setReplySuggestionLoading(false);
    setReplySuggestionError("");
    setReplyCopied(false);
  }

  function clearGeneratedResults() {
    translationRequestIdRef.current += 1;
    setLoading(false);
    setOutput("");
    setPolishedSourceText("");
    setCopied(false);
    clearReplySuggestion();
  }

  function updateSourceLanguage(nextLanguage: TranslationLanguage) {
    clearGeneratedResults();
    setError("");
    if (nextLanguage === targetLanguage) {
      setTargetLanguage(sourceLanguage);
    }
    setSourceLanguage(nextLanguage);
  }

  function updateTargetLanguage(nextLanguage: TranslationLanguage) {
    clearGeneratedResults();
    setError("");
    if (nextLanguage === sourceLanguage) {
      setSourceLanguage(targetLanguage);
    }
    setTargetLanguage(nextLanguage);
  }

  function swapLanguages() {
    translationRequestIdRef.current += 1;
    setLoading(false);
    clearReplySuggestion();
    setCopied(false);
    setError("");
    setPolishedSourceText("");
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    if (output) {
      setInput(output);
      setOutput(input);
    }
  }

  async function requestReplySuggestion({
    requestSourceLanguage,
    sourceText,
    customerMessageKo
  }: {
    requestSourceLanguage: PatientLanguage;
    sourceText: string;
    customerMessageKo: string;
  }) {
    const requestId = replySuggestionRequestIdRef.current + 1;
    replySuggestionRequestIdRef.current = requestId;
    setSuggestedReplyKo("");
    setTranslatedReply("");
    setReplySuggestionLoading(true);
    setReplySuggestionError("");
    setReplyCopied(false);

    try {
      const response = await fetch("/api/staff-text-reply-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLanguage: requestSourceLanguage,
          sourceText,
          customerMessageKo
        })
      });
      const data = (await response.json().catch(() => null)) as
        | ReplySuggestionResponse
        | null;

      if (requestId !== replySuggestionRequestIdRef.current) return;

      if (response.status === 401) {
        setError("로그인이 만료되었습니다. 다시 로그인해주세요.");
        router.replace("/login");
        return;
      }
      if (
        !response.ok ||
        !data?.suggestedReplyKo ||
        !data.translatedReply
      ) {
        throw new Error(data?.error ?? "예상 답변을 만들지 못했습니다.");
      }

      setSuggestedReplyKo(data.suggestedReplyKo);
      setTranslatedReply(data.translatedReply);
    } catch (caught) {
      if (requestId !== replySuggestionRequestIdRef.current) return;
      setReplySuggestionError(
        caught instanceof Error
          ? caught.message
          : "예상 답변을 만들지 못했습니다."
      );
    } finally {
      if (requestId === replySuggestionRequestIdRef.current) {
        setReplySuggestionLoading(false);
      }
    }
  }

  async function translate() {
    const text = input.trim();
    if (!text || !canTranslate) return;

    const requestId = translationRequestIdRef.current + 1;
    translationRequestIdRef.current = requestId;
    setLoading(true);
    setCopied(false);
    setError("");
    setOutput("");
    setPolishedSourceText("");
    clearReplySuggestion();

    try {
      const response = await fetch("/api/staff-text-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceLanguage, targetLanguage, text })
      });
      const data = (await response.json().catch(() => null)) as
        | TranslatorResponse
        | null;

      if (requestId !== translationRequestIdRef.current) return;

      if (response.status === 401) {
        setError("로그인이 만료되었습니다. 다시 로그인해주세요.");
        router.replace("/login");
        return;
      }
      if (!response.ok || !data?.translatedText) {
        throw new Error(data?.error ?? "번역하지 못했습니다.");
      }

      setOutput(data.translatedText);
      setPolishedSourceText(data.polishedSourceText?.trim() ?? "");
      if (sourceLanguage !== "ko" && targetLanguage === "ko") {
        void requestReplySuggestion({
          requestSourceLanguage: sourceLanguage,
          sourceText: text,
          customerMessageKo: data.translatedText
        });
      }
    } catch (caught) {
      if (requestId !== translationRequestIdRef.current) return;
      setError(
        caught instanceof Error ? caught.message : "번역하지 못했습니다."
      );
    } finally {
      if (requestId === translationRequestIdRef.current) {
        setLoading(false);
      }
    }
  }

  async function copyOutput() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("복사 권한을 확인해주세요.");
    }
  }

  async function copyReplyOutput() {
    if (!translatedReply) return;
    try {
      await navigator.clipboard.writeText(translatedReply);
      setReplyCopied(true);
      window.setTimeout(() => setReplyCopied(false), 1400);
    } catch {
      setReplySuggestionError("복사 권한을 확인해주세요.");
    }
  }

  function retryReplySuggestion() {
    const sourceText = input.trim();
    const customerMessageKo = output.trim();
    if (
      sourceLanguage === "ko" ||
      targetLanguage !== "ko" ||
      !sourceText ||
      !customerMessageKo
    ) {
      return;
    }

    void requestReplySuggestion({
      requestSourceLanguage: sourceLanguage,
      sourceText,
      customerMessageKo
    });
  }

  function speak(text: string, language: TranslationLanguage) {
    if (!text.trim()) return;
    if (!("speechSynthesis" in window)) {
      setError("이 브라우저에서는 음성 재생을 사용할 수 없습니다.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocales[language];
    window.speechSynthesis.speak(utterance);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (isComposingRef.current || event.nativeEvent.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void translate();
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-104px)] flex-col space-y-3 md:space-y-4">
      <header className="rounded-lg bg-ink p-5 text-white shadow-soft md:p-7">
        <p className="truncate text-sm font-bold text-blue-200">
          {staff.hospital.name}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold leading-tight md:text-[38px]">
              텍스트 번역하기
            </h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300 md:text-base">
              {staff.name} 상담사용 병원 문장 번역
            </p>
          </div>
          <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-bold text-white">
            <Languages size={18} />
            상담 번역
          </span>
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] lg:items-start">
        <div className="flex min-h-[300px] flex-col overflow-hidden rounded-lg border border-line bg-white shadow-soft md:min-h-[360px]">
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
            <select
              value={sourceLanguage}
              onChange={(event) =>
                updateSourceLanguage(
                  event.target.value as TranslationLanguage
                )
              }
              className="h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-white px-2 text-lg font-bold text-ink outline-none transition hover:border-line focus:border-trust md:text-xl"
              aria-label="원문 언어"
            >
              {orderedLanguages.map((language) => (
                <option key={language} value={language}>
                  {languageDisplay(language)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setInput("");
                clearGeneratedResults();
                setError("");
              }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-coral"
              aria-label="입력 지우기"
              title="입력 지우기"
            >
              <Trash2 size={20} />
            </button>
          </div>

          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              clearGeneratedResults();
              setError("");
            }}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onKeyDown={handleInputKeyDown}
            maxLength={maxCharacters}
            placeholder="번역할 내용을 입력하세요"
            className="min-h-[170px] flex-1 resize-none border-0 bg-white p-5 text-[24px] font-semibold leading-[1.42] text-ink outline-none placeholder:text-slate-300 md:min-h-[220px] md:p-6 md:text-[28px]"
          />

          <div className="grid min-h-16 grid-cols-[56px_1fr_auto] border-t border-line md:grid-cols-[64px_1fr_auto]">
            <button
              type="button"
              onClick={() => speak(input, sourceLanguage)}
              className="grid place-items-center border-r border-line text-slate-400 transition hover:bg-slate-50 hover:text-ink"
              aria-label="원문 듣기"
              title="원문 듣기"
            >
              <Volume2 size={22} />
            </button>
            <div className="flex items-center justify-end px-4 text-sm font-bold text-slate-500 md:text-base">
              <span className={characters > maxCharacters ? "text-coral" : ""}>
                {characters}
              </span>
              <span className="text-slate-400">/{maxCharacters}</span>
            </div>
            <button
              type="button"
              onClick={() => void translate()}
              disabled={!canTranslate}
              className="flex min-w-[128px] items-center justify-center gap-2 bg-mint px-5 text-base font-bold text-white transition hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 md:min-w-[152px] md:text-lg"
            >
              {loading ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <Languages size={22} />
              )}
              번역하기
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={swapLanguages}
            className="grid h-12 w-12 place-items-center rounded-lg border border-line bg-white text-slate-500 shadow-sm transition hover:border-trust hover:text-trust"
            aria-label="언어 바꾸기"
            title="언어 바꾸기"
          >
            <ArrowLeftRight size={22} />
          </button>
        </div>

        <div className="flex min-h-[300px] flex-col overflow-hidden rounded-lg border border-line bg-white shadow-soft md:min-h-[360px]">
          <div className="flex min-h-16 flex-col gap-2 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
            <select
              value={targetLanguage}
              onChange={(event) =>
                updateTargetLanguage(
                  event.target.value as TranslationLanguage
                )
              }
              className="h-11 min-w-0 rounded-lg border border-transparent bg-white px-2 text-lg font-bold text-ink outline-none transition hover:border-line focus:border-trust md:flex-1 md:text-xl"
              aria-label="번역 언어"
            >
              {orderedLanguages.map((language) => (
                <option key={language} value={language}>
                  {languageDisplay(language)}
                </option>
              ))}
            </select>
            <div className="flex shrink-0 gap-1.5">
              {priorityTargetLanguages.map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => updateTargetLanguage(language)}
                  className={`h-9 rounded-lg px-3 text-xs font-bold transition ${
                    targetLanguage === language
                      ? "bg-blue-50 text-trust"
                      : "bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-trust"
                  }`}
                >
                  {compactLanguageDisplay(language)}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[170px] flex-1 whitespace-pre-wrap p-5 text-[24px] font-semibold leading-[1.42] text-ink md:min-h-[220px] md:p-6 md:text-[28px]">
            {loading ? (
              <div className="flex h-full min-h-[160px] items-center justify-center text-base font-bold text-slate-400">
                <Loader2 size={24} className="mr-2 animate-spin" />
                번역 중
              </div>
            ) : output ? (
              <div className="space-y-4">
                <div>{output}</div>
                {shouldShowPolishedSource ? (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm font-semibold leading-6 text-slate-600">
                    <span className="mb-1 block text-xs font-bold text-trust">
                      번역 기준 한국어
                    </span>
                    <span className="whitespace-pre-wrap">
                      {polishedSourceText}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <span className="text-slate-300">
                번역 결과가 여기에 표시됩니다
              </span>
            )}
          </div>

          <div className="grid min-h-16 grid-cols-[56px_56px_1fr] border-t border-line md:grid-cols-[64px_64px_1fr]">
            <button
              type="button"
              onClick={() => speak(output, targetLanguage)}
              className="grid place-items-center border-r border-line text-slate-400 transition hover:bg-slate-50 hover:text-ink"
              aria-label="번역문 듣기"
              title="번역문 듣기"
            >
              <Volume2 size={22} />
            </button>
            <button
              type="button"
              onClick={() => void copyOutput()}
              className="grid place-items-center border-r border-line text-slate-400 transition hover:bg-slate-50 hover:text-ink"
              aria-label="번역문 복사"
              title="번역문 복사"
            >
              {copied ? (
                <Check size={22} className="text-mint" />
              ) : (
                <Clipboard size={22} />
              )}
            </button>
            <div className="flex items-center justify-end px-4 text-sm font-bold text-slate-500">
              {translationLanguageLabels[targetLanguage].native}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquareReply size={20} className="shrink-0 text-trust" />
            <h2 className="truncate text-base font-bold text-ink md:text-lg">
              예상 답변
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {replySuggestionLoading ? (
              <Loader2 size={20} className="animate-spin text-slate-400" />
            ) : null}
            <button
              type="button"
              onClick={() => void copyReplyOutput()}
              disabled={!translatedReply}
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-ink disabled:cursor-not-allowed disabled:text-slate-200 disabled:hover:bg-transparent"
              aria-label="예상 답변 복사"
              title="예상 답변 복사"
            >
              {replyCopied ? (
                <Check size={19} className="text-mint" />
              ) : (
                <Clipboard size={19} />
              )}
            </button>
          </div>
        </div>

        {shouldShowReplySuggestion && replySuggestionLoading ? (
          <div className="flex min-h-36 items-center justify-center px-5 py-8 text-sm font-bold text-slate-400">
            예상 답변 생성 중
          </div>
        ) : shouldShowReplySuggestion && suggestedReplyKo && translatedReply ? (
          <div className="grid md:grid-cols-2">
            <div className="border-b border-line p-5 md:border-b-0 md:border-r md:p-6">
              <p className="mb-2 text-xs font-bold text-slate-500">
                한국어 답변
              </p>
              <p className="whitespace-pre-wrap text-lg font-semibold leading-8 text-ink md:text-xl">
                {suggestedReplyKo}
              </p>
            </div>
            <div className="p-5 md:p-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-trust">
                  {translationLanguageLabels[sourceLanguage].ko} 답변
                </p>
                <button
                  type="button"
                  onClick={() => speak(translatedReply, sourceLanguage)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-ink"
                  aria-label="예상 답변 듣기"
                  title="예상 답변 듣기"
                >
                  <Volume2 size={19} />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-lg font-semibold leading-8 text-ink md:text-xl">
                {translatedReply}
              </p>
            </div>
          </div>
        ) : shouldShowReplySuggestion && replySuggestionError ? (
          <div className="flex min-h-28 items-center justify-between gap-4 px-5 py-6">
            <p className="text-sm font-semibold leading-6 text-slate-600">
              {replySuggestionError}
            </p>
            <button
              type="button"
              onClick={retryReplySuggestion}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-slate-500 transition hover:border-trust hover:text-trust"
              aria-label="예상 답변 다시 만들기"
              title="예상 답변 다시 만들기"
            >
              <RefreshCw size={19} />
            </button>
          </div>
        ) : (
          <div className="flex min-h-28 items-center px-5 py-6 text-base font-semibold text-slate-300">
            예상 답변이 여기에 표시됩니다
          </div>
        )}
      </section>
      {error ? (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
