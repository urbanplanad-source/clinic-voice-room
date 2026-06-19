"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, Clipboard, FileText, Languages, Loader2, Trash2, Volume2 } from "lucide-react";
import { translationLanguageLabels, translationLanguages, type TranslationLanguage } from "@/lib/languages";

const maxCharacters = 3000;
const priorityTargetLanguages = ["zh", "en", "ja"] as const satisfies readonly TranslationLanguage[];
const orderedLanguages = [
  "ko",
  "zh",
  "en",
  "ja",
  "zh_tw",
  "yue",
  ...translationLanguages.filter((language) => !["ko", "zh", "en", "ja", "zh_tw", "yue"].includes(language))
] as TranslationLanguage[];

const defaultPhrases = [
  "통증은 어떠세요?",
  "눈 감고 계세요.",
  "시술 후 붓기가 있을 수 있어요.",
  "오늘은 사우나와 음주를 피해주세요."
];

const maxRememberedPhrases = 50;

type RememberedPhrase = {
  id: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  text: string;
  polishedText: string;
  translatedText?: string;
  count: number;
  lastUsedAt: number;
  createdAt: number;
};

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

function normalizeForPhraseMatch(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function polishHospitalPhrase(text: string) {
  let polished = text
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.?!。？！])/g, "$1")
    .trim();

  polished = polished.replace(/(\d+)\s*샷에\s*([0-9,]+)\s*만원/g, "$1샷 기준 $2만원");
  polished = polished.replace(/([가-힣])해주세요/g, "$1해 주세요");

  if (polished && !/[.!?。？！]$/.test(polished)) {
    polished += ".";
  }

  return polished;
}

function phraseSimilarityScore(query: string, candidate: string) {
  const normalizedQuery = normalizeForPhraseMatch(query);
  const normalizedCandidate = normalizeForPhraseMatch(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedCandidate === normalizedQuery) return 1;
  if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) return 0.95;

  const queryChars = new Set(Array.from(normalizedQuery));
  const candidateChars = new Set(Array.from(normalizedCandidate));
  let overlap = 0;
  queryChars.forEach((character) => {
    if (candidateChars.has(character)) overlap += 1;
  });

  return overlap / Math.max(queryChars.size, candidateChars.size);
}

function storageKeyForHospital(hospitalName: string) {
  return `clinic-voice-room:staff-text-phrases:v1:${hospitalName}`;
}

export function StaffTextTranslator({
  staff
}: {
  staff: { name: string; hospital: { name: string } };
}) {
  const router = useRouter();
  const [sourceLanguage, setSourceLanguage] = useState<TranslationLanguage>("ko");
  const [targetLanguage, setTargetLanguage] = useState<TranslationLanguage>("zh");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [polishedSourceText, setPolishedSourceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [rememberedPhrases, setRememberedPhrases] = useState<RememberedPhrase[]>([]);
  const [phrasesLoaded, setPhrasesLoaded] = useState(false);
  const isComposingRef = useRef(false);
  const phraseStorageKey = storageKeyForHospital(staff.hospital.name);

  const characters = input.length;
  const canTranslate = input.trim().length > 0 && characters <= maxCharacters && sourceLanguage !== targetLanguage && !loading;
  const shouldShowPolishedSource =
    sourceLanguage === "ko" && targetLanguage !== "ko" && output.trim().length > 0 && polishedSourceText.trim().length > 0;
  const suggestedPhrases = useMemo(() => {
    if (input.trim().length < 3) return [];

    return rememberedPhrases
      .filter((phrase) => phrase.sourceLanguage === sourceLanguage)
      .map((phrase) => ({
        phrase,
        score: Math.max(
          phraseSimilarityScore(input, phrase.text),
          phraseSimilarityScore(input, phrase.polishedText)
        )
      }))
      .filter(({ score }) => score >= 0.48)
      .sort((a, b) => b.score - a.score || b.phrase.count - a.phrase.count || b.phrase.lastUsedAt - a.phrase.lastUsedAt)
      .slice(0, 4)
      .map(({ phrase }) => phrase);
  }, [input, rememberedPhrases, sourceLanguage]);
  const frequentPhrases = useMemo(
    () =>
      rememberedPhrases
        .filter((phrase) => phrase.sourceLanguage === sourceLanguage)
        .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
        .slice(0, 8),
    [rememberedPhrases, sourceLanguage]
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(phraseStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as RememberedPhrase[];
        if (Array.isArray(parsed)) {
          setRememberedPhrases(
            parsed.filter(
              (phrase) =>
                phrase &&
                typeof phrase.id === "string" &&
                typeof phrase.text === "string" &&
                typeof phrase.polishedText === "string" &&
                typeof phrase.count === "number"
            )
          );
        }
      }
    } catch {
      setRememberedPhrases([]);
    } finally {
      setPhrasesLoaded(true);
    }
  }, [phraseStorageKey]);

  useEffect(() => {
    if (!phrasesLoaded) return;
    try {
      window.localStorage.setItem(phraseStorageKey, JSON.stringify(rememberedPhrases));
    } catch {
      // Phrase memory is a convenience feature. Translation should keep working if storage is unavailable.
    }
  }, [phraseStorageKey, phrasesLoaded, rememberedPhrases]);

  function updateSourceLanguage(nextLanguage: TranslationLanguage) {
    setCopied(false);
    setError("");
    setPolishedSourceText("");
    if (nextLanguage === targetLanguage) {
      setTargetLanguage(sourceLanguage);
    }
    setSourceLanguage(nextLanguage);
  }

  function updateTargetLanguage(nextLanguage: TranslationLanguage) {
    setCopied(false);
    setError("");
    setPolishedSourceText("");
    if (nextLanguage === sourceLanguage) {
      setSourceLanguage(targetLanguage);
    }
    setTargetLanguage(nextLanguage);
  }

  function swapLanguages() {
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

  function rememberPhrase(sourceText: string, translatedText: string, serverPolishedText?: string | null) {
    const text = sourceText.trim();
    if (text.length < 3) return;

    const now = Date.now();
    const polishedText = serverPolishedText?.trim() || polishHospitalPhrase(text);
    const normalizedText = normalizeForPhraseMatch(polishedText);
    setRememberedPhrases((current) => {
      const existing = current.find(
        (phrase) =>
          phrase.sourceLanguage === sourceLanguage &&
          normalizeForPhraseMatch(phrase.polishedText) === normalizedText
      );

      const nextEntry: RememberedPhrase = existing
        ? {
            ...existing,
            targetLanguage,
            text,
            polishedText,
            translatedText,
            count: existing.count + 1,
            lastUsedAt: now
          }
        : {
            id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
            sourceLanguage,
            targetLanguage,
            text,
            polishedText,
            translatedText,
            count: 1,
            createdAt: now,
            lastUsedAt: now
          };

      return [nextEntry, ...current.filter((phrase) => phrase.id !== nextEntry.id)]
        .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
        .slice(0, maxRememberedPhrases);
    });
  }

  async function translate() {
    const text = input.trim();
    if (!text || !canTranslate) return;

    setLoading(true);
    setCopied(false);
    setError("");
    setPolishedSourceText("");
    try {
      const response = await fetch("/api/staff-text-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceLanguage, targetLanguage, text })
      });
      const data = (await response.json().catch(() => null)) as TranslatorResponse | null;

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
      rememberPhrase(text, data.translatedText, data.polishedSourceText);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "번역하지 못했습니다.");
    } finally {
      setLoading(false);
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

  function applyTextPhrase(phrase: string) {
    setInput(phrase);
    setOutput("");
    setPolishedSourceText("");
    setSourceLanguage("ko");
    if (targetLanguage === "ko") {
      setTargetLanguage("zh");
    }
    setError("");
  }

  function applyRememberedPhrase(phrase: RememberedPhrase) {
    setInput(phrase.polishedText);
    setSourceLanguage(phrase.sourceLanguage);
    if (phrase.sourceLanguage === targetLanguage && phrase.targetLanguage !== phrase.sourceLanguage) {
      setTargetLanguage(phrase.targetLanguage);
    }
    setError("");
    if (phrase.targetLanguage === targetLanguage && phrase.translatedText) {
      setOutput(phrase.translatedText);
      setPolishedSourceText(phrase.sourceLanguage === "ko" && phrase.targetLanguage !== "ko" ? phrase.polishedText : "");
    } else {
      setOutput("");
      setPolishedSourceText("");
    }
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
        <p className="truncate text-sm font-bold text-blue-200">{staff.hospital.name}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold leading-tight md:text-[38px]">텍스트 번역하기</h1>
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
              onChange={(event) => updateSourceLanguage(event.target.value as TranslationLanguage)}
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
                setOutput("");
                setPolishedSourceText("");
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
              setOutput("");
              setPolishedSourceText("");
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

          {suggestedPhrases.length > 0 ? (
            <div className="border-t border-line bg-blue-50/40 px-4 py-3">
              <p className="mb-2 text-xs font-bold text-trust">입력 기록 추천</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPhrases.map((phrase) => (
                  <button
                    key={phrase.id}
                    type="button"
                    onClick={() => applyRememberedPhrase(phrase)}
                    className="max-w-full truncate rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-ink transition hover:border-trust hover:text-trust"
                    title={phrase.polishedText}
                  >
                    {phrase.polishedText}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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
              <span className={characters > maxCharacters ? "text-coral" : ""}>{characters}</span>
              <span className="text-slate-400">/{maxCharacters}</span>
            </div>
            <button
              type="button"
              onClick={() => void translate()}
              disabled={!canTranslate}
              className="flex min-w-[128px] items-center justify-center gap-2 bg-mint px-5 text-base font-bold text-white transition hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 md:min-w-[152px] md:text-lg"
            >
              {loading ? <Loader2 size={22} className="animate-spin" /> : <Languages size={22} />}
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
              onChange={(event) => updateTargetLanguage(event.target.value as TranslationLanguage)}
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
                    targetLanguage === language ? "bg-blue-50 text-trust" : "bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-trust"
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
                    <span className="mb-1 block text-xs font-bold text-trust">번역 기준 한국어</span>
                    <span className="whitespace-pre-wrap">{polishedSourceText}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <span className="text-slate-300">번역 결과가 여기에 표시됩니다</span>
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
              {copied ? <Check size={22} className="text-mint" /> : <Clipboard size={22} />}
            </button>
            <div className="flex items-center justify-end px-4 text-sm font-bold text-slate-500">
              {translationLanguageLabels[targetLanguage].native}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
          <FileText size={17} className="text-trust" />
          {frequentPhrases.length > 0 ? "자주 쓰는 문장" : "기본 문장"}
        </div>
        <div className="flex flex-wrap gap-2">
          {frequentPhrases.length > 0
            ? frequentPhrases.map((phrase) => (
                <button
                  key={phrase.id}
                  type="button"
                  onClick={() => applyRememberedPhrase(phrase)}
                  className="max-w-full truncate rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm font-bold text-ink transition hover:border-trust hover:bg-blue-50 hover:text-trust"
                  title={phrase.polishedText}
                >
                  {phrase.polishedText}
                </button>
              ))
            : defaultPhrases.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => applyTextPhrase(phrase)}
                  className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm font-bold text-ink transition hover:border-trust hover:bg-blue-50 hover:text-trust"
                >
                  {phrase}
                </button>
              ))}
        </div>
        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
