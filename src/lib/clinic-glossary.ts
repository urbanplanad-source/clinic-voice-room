import type { PatientLanguage } from "./languages";
import {
  buildKoreanClinicTranscriptionPrompt,
  defaultClinicTranscriptionPromptMaxChars,
  normalizeClinicSourceTranscript as normalizeSourceTranscript,
  transcriptionMappingsFromTerms,
  type ClinicTranscriptionHintMapping,
  type ClinicTranscriptionPromptDetails
} from "./clinic-transcription";
import {
  medicalTranscriptionContextInstruction,
  medicalTranscriptionSafetyEnabled
} from "./medical-transcription-safety";

export type { ClinicTranscriptionConflict, ClinicTranscriptionHintMapping } from "./clinic-transcription";

function buildKoreanTranscriptionPromptDetails(
  transcriptionHints: string[],
  transcriptionHintMappings: ClinicTranscriptionHintMapping[],
  maxChars: number
) {
  const includeSafetyCandidate = medicalTranscriptionSafetyEnabled();
  const extraChars = includeSafetyCandidate ? medicalTranscriptionContextInstruction.length + 1 : 0;
  const baseMaxChars = includeSafetyCandidate ? Math.max(600, maxChars - extraChars) : maxChars;
  const details = buildKoreanClinicTranscriptionPrompt(
    transcriptionHints,
    transcriptionHintMappings,
    baseMaxChars
  );
  if (!includeSafetyCandidate) return details;

  const prompt = `${details.prompt} ${medicalTranscriptionContextInstruction}`.trim();
  return { ...details, prompt, chars: prompt.length };
}

export type GlossaryTargetLanguage = PatientLanguage | "ko";
export type CriticalShortPhrase = {
  spoken: string[];
  translations: Partial<Record<GlossaryTargetLanguage, string>> & Record<"ko" | "zh" | "zh_tw" | "ja" | "en", string>;
  note: string;
};

export type ClinicGlossaryEntry = {
  entryId?: string;
  spoken: string[];
  standardKo: string;
  zh: string;
  ja: string;
  en: string;
  ru: string;
  vi: string;
  id: string;
  category: string;
  note: string;
};

export type VerifiedSentenceEntry = {
  entryId?: string;
  spoken: string[];
  standardKo: string;
  translations: Partial<Record<GlossaryTargetLanguage, string>>;
  category: string;
  note: string;
};

export type ClinicGlossaryData = {
  terms: ClinicGlossaryEntry[];
  criticalPhrases: CriticalShortPhrase[];
  transcriptionHints: string[];
  transcriptionHintMappings?: ClinicTranscriptionHintMapping[];
  verifiedSentences: VerifiedSentenceEntry[];
  metadata?: {
    glossaryVersion: string;
    packVersion: string;
    normalizationVersion: number;
  };
};

const rawGlossaryTargetLanguages = new Set<GlossaryTargetLanguage>(["ko", "zh", "zh_tw", "yue", "ja", "en", "ru", "vi", "id"]);

export const realtimeKoreanTranscriptionHints = [
  "한약",
  "약침",
  "특정 약재",
  "약재",
  "상처가 벌어지다",
  "심해지는 붉어짐",
  "붉어짐",
  "발적",
  "의치",
  "보청기",
  "피어싱",
  "리쥬란",
  "리주란",
  // Highest-frequency competing brands and devices must fit the Realtime 1,024-char prompt.
  "Re2O",
  "리투오",
  "울쎄라",
  "울쎄라 프라임",
  "울쎄라피 프라임",
  "써마지",
  "써마지 FLX",
  "리쥬란 힐러",
  "리쥬란 블랙박스",
  "리쥬란 레드박스",
  "리쥬란 HB",
  "리쥬란 아이",
  "리쥬란 S",
  "리쥬란 엘라스킨",
  "블랙박스",
  "레드박스",
  "화이트박스",
  "블루박스",
  "퍼플박스",
  "쥬베룩",
  "쥬베룩 볼륨",
  "Re2O",
  "리투오",
  "리투오 주사",
  "리투오 스킨부스터",
  "동종진피",
  "hADM",
  "ECM",
  "울쎄라",
  "울쎄라 프라임",
  "울쎄라피 프라임",
  "켈로이드",
  "써마지",
  "써마지 FLX",
  "세르프",
  "셀프 리프팅",
  "XERF",
  "티타늄 리프팅",
  "레비나스",
  "온다",
  "브이로 어드밴스",
  "브이로리프팅",
  "슈링크 유니버스",
  "포텐자",
  "듀얼 프락셀",
  "미라클 잡티 클리닉",
  "피코레이저",
  "C+B 토닝",
  "프락셔널 레이저",
  "스탬프",
  "PDRN",
  "PRP",
  "LDM",
  "HDA",
  "주비덤",
  "쥬비덤",
  "레스틸렌",
  "레스틸렌 비탈",
  "벨로테로",
  "엘라비에",
  "스컬트라",
  "스킨바이브",
  "하이쥬",
  "더마샤인",
  "리즈톡스",
  "디스포트",
  "제오민",
  "앨러간",
  "브이라인 보톡스",
  "풀페이스 보톡스",
  "사각턱 보톡스",
  "침샘 보톡스",
  "승모근 보톡스",
  "종아리 보톡스",
  "다한증 보톡스",
  "블랙필",
  "아쿠아필",
  "라라필",
  "물톡필",
  "핑크필",
  "산소필",
  "예스필",
  "소노스타일러",
  "테라클리어",
  "스킨부스터",
  "보툴리눔 톡신",
  "필러",
  "시술",
  "시술에 관심이 있으세요?",
  "어떤 시술에 관심이 있으세요?",
  "원하시는 시술이 있으세요?",
  "시술을 진행하겠습니다",
  "시술을 시작하겠습니다",
  "시술 전에 확인하겠습니다",
  "시술 후에 주의해 주세요",
  "시술 시간은 얼마나 걸리나요?",
  "시술 받으신 적 있으세요?",
  "오늘 시술 가능하세요?",
  "시술 부위를 확인하겠습니다",
  "울쎄라 시술에 관심이 있으세요?",
  "써마지 시술에 관심이 있으세요?",
  "부종",
  "붓기",
  "멍",
  "홍반",
  "통증",
  "따가움",
  "가려움",
  "건조감",
  "부종이 생길 수 있어요",
  "붓기가 있을 수 있어요",
  "멍이 생길 수 있어요",
  "붉어질 수 있어요",
  "통증이 있을 수 있어요",
  "일시적인 반응입니다",
  "아프지 않으세요?",
  "통증은 어떠세요?",
  "괜찮으세요?",
  "움직이지 마세요",
  "눈 감고 계세요"
];

const commonBrandCorrectionPatterns = [
  /니[주쥬]란/g,
  /리주란/g,
  /\bni[\s-]?juran\b/gi,
  /\bni[\s-]?zuran\b/gi,
  /\bniju[\s-]?ran\b/gi,
  /\bnizhu[\s-]?ran\b/gi,
  /丽珠蓝|丽珠澜|李珠兰|力珠兰|力猪蓝|力猪兰|利诸兰|丽驻兰|丽主兰|力主兰|利珠兰/g
];

const swellingTermByLanguage: Partial<Record<GlossaryTargetLanguage, string>> = {
  ko: "부종",
  zh: "肿胀",
  yue: "腫脹",
  zh_tw: "腫脹",
  ja: "腫れ",
  en: "swelling",
  ru: "отек",
  vi: "sưng",
  id: "bengkak",
  ms: "bengkak",
  tl: "pamamaga",
  fr: "gonflement",
  es: "hinchazón",
  de: "Schwellung",
  it: "gonfiore",
  pt: "inchaço"
};

const swellingPhraseByLanguage: Partial<Record<GlossaryTargetLanguage, string>> = {
  ko: "부종이 생길 수 있어요.",
  zh: "可能会出现肿胀。",
  yue: "可能會出現腫脹。",
  zh_tw: "可能會出現腫脹。",
  ja: "腫れが出ることがあります。",
  en: "Swelling may occur.",
  ru: "Может появиться отек.",
  vi: "Có thể bị sưng.",
  id: "Bengkak bisa terjadi.",
  ms: "Bengkak boleh berlaku.",
  tl: "Maaaring magkaroon ng pamamaga.",
  fr: "Un gonflement peut apparaître.",
  es: "Puede aparecer hinchazón.",
  de: "Es kann zu einer Schwellung kommen.",
  it: "Può comparire gonfiore.",
  pt: "Pode ocorrer inchaço."
};

type ClinicBrandKey =
  | "rejuran"
  | "rejuranHealer"
  | "rejuranHb"
  | "rejuranI"
  | "rejuranS"
  | "rejuranElaskin"
  | "juvelook"
  | "juvelookVolume"
  | "re2o";

const brandDisplayByLanguage: Partial<Record<GlossaryTargetLanguage, Record<ClinicBrandKey, string>>> = {
  ko: {
    rejuran: "리쥬란",
    rejuranHealer: "리쥬란 힐러",
    rejuranHb: "리쥬란 HB",
    rejuranI: "리쥬란 아이",
    rejuranS: "리쥬란 S",
    rejuranElaskin: "리쥬란 엘라스킨",
    juvelook: "쥬베룩",
    juvelookVolume: "쥬베룩 볼륨",
    re2o: "Re2O"
  },
  zh: {
    rejuran: "丽珠兰",
    rejuranHealer: "丽珠兰 Healer",
    rejuranHb: "丽珠兰红盒",
    rejuranI: "丽珠兰白盒",
    rejuranS: "丽珠兰蓝盒",
    rejuranElaskin: "丽珠兰紫盒",
    juvelook: "Juvelook",
    juvelookVolume: "Juvelook Volume",
    re2o: "Re2O"
  },
  zh_tw: {
    rejuran: "麗珠蘭",
    rejuranHealer: "麗珠蘭 Healer",
    rejuranHb: "麗珠蘭紅盒",
    rejuranI: "麗珠蘭白盒",
    rejuranS: "麗珠蘭藍盒",
    rejuranElaskin: "麗珠蘭紫盒",
    juvelook: "Juvelook",
    juvelookVolume: "Juvelook Volume",
    re2o: "Re2O"
  },
  yue: {
    rejuran: "麗珠蘭",
    rejuranHealer: "麗珠蘭 Healer",
    rejuranHb: "麗珠蘭紅盒",
    rejuranI: "麗珠蘭白盒",
    rejuranS: "麗珠蘭藍盒",
    rejuranElaskin: "麗珠蘭紫盒",
    juvelook: "Juvelook",
    juvelookVolume: "Juvelook Volume",
    re2o: "Re2O"
  },
  ja: {
    rejuran: "リジュラン",
    rejuranHealer: "リジュランヒーラー",
    rejuranHb: "リジュランHB",
    rejuranI: "リジュランアイ",
    rejuranS: "リジュランS",
    rejuranElaskin: "リジュラン エラスキン",
    juvelook: "ジュベルック",
    juvelookVolume: "ジュベルック ボリューム",
    re2o: "Re2O"
  }
};

const rawClinicGlossary = `
약침|藥針|药针|pharmacopuncture,약침,药针,薬鍼,pharmacopuncture injection,фармакопунктура,tiêm dược châm,suntikan farmakopunktur,procedure,약침은 일반 주사나 일반 침 치료로 바꾸지 않음
침치료|침 치료|침|針灸|针灸|針刺|针刺|鍼治療|鍼|acupuncture,침 치료,针灸治疗,鍼治療,acupuncture treatment,иглоукалывание,châm cứu,akupunktur,procedure,한의학 침 치료는 주사로 번역하지 않음
주사|注射|injection,주사,注射,注射,injection,инъекция,tiêm,suntikan,procedure,일반 주사는 침 치료나 약침으로 번역하지 않음
오십샷|50샷,50샷,五十发,ごじゅうショット,fifty shots,пятьдесят импульсов,năm mươi shot,lima puluh shot,count,샷 수
백오십샷|150샷,150샷,一百五十发,ひゃくごじゅうショット,one hundred fifty shots,сто пятьдесят импульсов,một trăm năm mươi shot,seratus lima puluh shot,count,샷 수
이백오십샷|250샷,250샷,两百五十发,にひゃくごじゅうショット,two hundred fifty shots,двести пятьдесят импульсов,hai trăm năm mươi shot,dua ratus lima puluh shot,count,샷 수
사백오십샷|450샷,450샷,四百五十发,よんひゃくごじゅうショット,four hundred fifty shots,четыреста пятьдесят импульсов,bốn trăm năm mươi shot,empat ratus lima puluh shot,count,샷 수
오백오십샷|550샷,550샷,五百五十发,ごひゃくごじゅうショット,five hundred fifty shots,пятьсот пятьдесят импульсов,năm trăm năm mươi shot,lima ratus lima puluh shot,count,샷 수
육백샷|600샷,600샷,六百发,ろっぴゃくショット,six hundred shots,шестьсот импульсов,sáu trăm shot,enam ratus shot,count,샷 수
백유닛|100유닛,100유닛,一百单位,ひゃくユニット,one hundred units,сто единиц,một trăm đơn vị,seratus unit,unit,보툴리눔 톡신 단위
백오십유닛|150유닛,150유닛,一百五十单位,ひゃくごじゅうユニット,one hundred fifty units,сто пятьдесят единиц,một trăm năm mươi đơn vị,seratus lima puluh unit,unit,보툴리눔 톡신 단위
이백유닛|200유닛,200유닛,两百单位,にひゃくユニット,two hundred units,двести единиц,hai trăm đơn vị,dua ratus unit,unit,보툴리눔 톡신 단위
이백오십유닛|250유닛,250유닛,两百五十单位,にひゃくごじゅうユニット,two hundred fifty units,двести пятьдесят единиц,hai trăm năm mươi đơn vị,dua ratus lima puluh unit,unit,보툴리눔 톡신 단위
삼백유닛|300유닛,300유닛,三百单位,さんびゃくユニット,three hundred units,триста единиц,ba trăm đơn vị,tiga ratus unit,unit,보툴리눔 톡신 단위
삼백오십유닛|350유닛,350유닛,三百五十单位,さんびゃくごじゅうユニット,three hundred fifty units,триста пятьдесят единиц,ba trăm năm mươi đơn vị,tiga ratus lima puluh unit,unit,보툴리눔 톡신 단위
사백유닛|400유닛,400유닛,四百单位,よんひゃくユニット,four hundred units,четыреста единиц,bốn trăm đơn vị,empat ratus unit,unit,보툴리눔 톡신 단위
사백오십유닛|450유닛,450유닛,四百五十单位,よんひゃくごじゅうユニット,four hundred fifty units,четыреста пятьдесят единиц,bốn trăm năm mươi đơn vị,empat ratus lima puluh unit,unit,보툴리눔 톡신 단위
오백유닛|500유닛,500유닛,五百单位,ごひゃくユニット,five hundred units,пятьсот единиц,năm trăm đơn vị,lima ratus unit,unit,보툴리눔 톡신 단위
오백오십유닛|550유닛,550유닛,五百五十单位,ごひゃくごじゅうユニット,five hundred fifty units,пятьсот пятьдесят единиц,năm trăm năm mươi đơn vị,lima ratus lima puluh unit,unit,보툴리눔 톡신 단위
육백유닛|600유닛,600유닛,六百单位,ろっぴゃくユニット,six hundred units,шестьсот единиц,sáu trăm đơn vị,enam ratus unit,unit,보툴리눔 톡신 단위
사씨씨|4cc|4씨씨,4cc,四毫升,よんミリリットル,four milliliters,четыре миллилитра,bốn mililit,empat mililiter,unit,용량
육씨씨|6cc|6씨씨,6cc,六毫升,ろくミリリットル,six milliliters,шесть миллилитров,sáu mililit,enam mililiter,unit,용량
칠씨씨|7cc|7씨씨,7cc,七毫升,ななミリリットル,seven milliliters,семь миллилитров,bảy mililit,tujuh mililiter,unit,용량
팔씨씨|8cc|8씨씨,8cc,八毫升,はちミリリットル,eight milliliters,восемь миллилитров,tám mililit,delapan mililiter,unit,용량
백샷|100샷,100샷,一百发,ひゃくショット,one hundred shots,сто импульсов,một trăm shot,seratus shot,count,샷 수
이백샷|200샷,200샷,两百发,にひゃくショット,two hundred shots,двести импульсов,hai trăm shot,dua ratus shot,count,샷 수
삼백샷|300샷,300샷,三百发,さんびゃくショット,three hundred shots,триста импульсов,ba trăm shot,tiga ratus shot,count,샷 수
삼백오십샷|350샷|삼오공샷,350샷,三百五十发,さんびゃくごじゅうショット,three hundred fifty shots,триста пятьдесят импульсов,ba trăm năm mươi shot,tiga ratus lima puluh shot,count,샷 수
사백샷|400샷,400샷,四百发,よんひゃくショット,four hundred shots,четыреста импульсов,bốn trăm shot,empat ratus shot,count,샷 수
오백샷|500샷,500샷,五百发,ごひゃくショット,five hundred shots,пятьсот импульсов,năm trăm shot,lima ratus shot,count,샷 수
일씨씨|1cc|1씨씨,1cc,一毫升,いちミリリットル,one milliliter,один миллилитр,một mililit,satu mililiter,unit,용량
이씨씨|2cc|2씨씨,2cc,两毫升,にミリリットル,two milliliters,два миллилитра,hai mililit,dua mililiter,unit,용량
삼씨씨|3cc|3씨씨,3cc,三毫升,さんミリリットル,three milliliters,три миллилитра,ba mililit,tiga mililiter,unit,용량
오씨씨|5cc|5씨씨,5cc,五毫升,ごミリリットル,five milliliters,пять миллилитров,năm mililit,lima mililiter,unit,용량
십유닛|10유닛,10유닛,十单位,じゅうユニット,ten units,десять единиц,mười đơn vị,sepuluh unit,unit,보툴리눔 톡신 단위
이십유닛|20유닛,20유닛,二十单位,にじゅうユニット,twenty units,двадцать единиц,hai mươi đơn vị,dua puluh unit,unit,보툴리눔 톡신 단위
오십유닛|50유닛,50유닛,五十单位,ごじゅうユニット,fifty units,пятьдесят единиц,năm mươi đơn vị,lima puluh unit,unit,보툴리눔 톡신 단위
한바이알|1바이알,1바이알,一瓶,いちバイアル,one vial,один флакон,một lọ,satu vial,unit,바이알 수
두바이알|2바이알,2바이알,两瓶,にバイアル,two vials,два флакона,hai lọ,dua vial,unit,바이알 수
울쎄라|울세라|울셀라|올셀라|웃음세라|울새나|美版超声刀|美版超聲刀,울쎄라,Ultherapy,ウルセラ,Ultherapy,Ultherapy,Ultherapy,Ultherapy,device,장비명 의역 금지
울쎄라피프라임|울쎄라 프라임|울세라피 프라임|울쎄라 핏 프라임,울쎄라피 프라임,Ultherapy Prime,ウルセラピー プライム,Ultherapy Prime,Ultherapy Prime,Ultherapy Prime,Ultherapy Prime,device,장비명 의역 금지
써마지|서마지|서머지|써머지|热玛吉|熱瑪吉|热马吉|熱馬吉|热麻吉|熱麻吉|热妈吉|惹玛吉,써마지,Thermage,サーマクール,Thermage,Thermage,Thermage,Thermage,device,장비명
써마지에프엘엑스|써마지 FLX|서마지 FLX|서머지 FLX|써머지 FLX,써마지 FLX,Thermage FLX,サーマクールFLX,Thermage FLX,Thermage FLX,Thermage FLX,Thermage FLX,device,장비명
세르프|세르프리프팅|세르프 리프팅|제르프|제르프리프팅|제르프 리프팅|셀프리프팅|셀프 리프팅|셀프 시술|Self lifting|Self Lifting|Self procedure|XERF lifting|XERF lifting treatment|XERF,XERF,XERF,ザーフ,XERF,XERF,XERF,XERF,device,장비명 의역 금지
포텐자|포텐자레이저|黄金微针|黃金微針,포텐자,Potenza 微针射频,ポテンツァ,Potenza,Potenza,Potenza,Potenza,device,장비명
실펌|실펌엑스|Sylfirm X,실펌 X,Sylfirm X,シルファームX,Sylfirm X,Sylfirm X,Sylfirm X,Sylfirm X,device,장비명
피코|피코레이저|皮秒|皮秒激光|皮秒镭射|皮秒雷射|皮妙,피코 레이저,皮秒激光,ピコレーザー,pico laser,пикосекундный лазер,laser pico,laser pico,device,레이저명
피코웨이|PicoWay,피코웨이,PicoWay 皮秒激光,ピコウェイ,PicoWay,PicoWay,PicoWay,PicoWay,device,장비명
피코슈어|PicoSure,피코슈어,PicoSure 皮秒激光,ピコシュア,PicoSure,PicoSure,PicoSure,PicoSure,device,장비명
브이빔|Vbeam,브이빔,Vbeam 激光,Vビーム,Vbeam,Vbeam,Vbeam,Vbeam,device,혈관레이저
엑셀브이|엑셀V|excel V|艾克赛尔V|艾克賽爾V|XLV,엑셀브이,excel V 激光,エクセルVレーザー,excel V laser,excel V laser,laser excel V,laser excel V,device,혈관레이저
프락셀|프락셀레이저,프락셀,Fraxel 激光,フラクセルレーザー,Fraxel laser,фракционный лазер Fraxel,laser Fraxel,laser Fraxel,device,프락셔널 레이저
볼뉴머|볼뉴머리프팅|Volnewmer,볼뉴머,Volnewmer,ボルニューマー,Volnewmer,Volnewmer,Volnewmer,Volnewmer,device,고주파 리프팅 장비명
주비덤|쥬비덤|Juvederm,주비덤,乔雅登,ジュビダーム,Juvederm,Juvederm,Juvederm,Juvederm,brand,필러 브랜드명
프로파일로|Profhilo,프로파일로,五点提升,プロファイロ,Profhilo,Profhilo,Profhilo,Profhilo,brand,스킨부스터 브랜드명
레니스나|렌티스|Lenisna|Lensis,레니스나,兰提斯,レニスナ,Lenisna,Lenisna,Lenisna,Lenisna,brand,스킨부스터 브랜드명
Re2O|리투오|리투오주사|리투오 주사|리투오스킨부스터|리투오 스킨부스터|리투어|리트오|알이투오|알이투오 주사,Re2O,Re2O,Re2O,Re2O,Re2O,Re2O,Re2O,brand,동종진피(hADM) 기반 스킨부스터 브랜드명
엘라비에|Elravie|엘라비에Re2O|Elravie Re2O,엘라비에,Elravie,エラビエ,Elravie,Elravie,Elravie,Elravie,brand,필러와 스킨부스터 가격표 브랜드명
레스틸렌|Restylane|瑞兰|瑞藍,레스틸렌,瑞蓝,レスチレン,Restylane,Restylane,Restylane,Restylane,brand,필러 브랜드명
벨로테로|Belotero|保揉提,벨로테로,保揉提,ベロテロ,Belotero,Belotero,Belotero,Belotero,brand,필러 브랜드명
레스틸렌비탈|레스틸렌 비탈|Restylane Vital|瑞蓝唯提|瑞藍唯提,레스틸렌 비탈,瑞蓝唯提,レスチレン ビタール,Restylane Vital,Restylane Vital,Restylane Vital,Restylane Vital,brand,스킨부스터 브랜드명
스킨바이브|스킨 바이브|SKIN VIVE|Skinvive,스킨바이브,SKIN VIVE,スキンバイブ,Skinvive,Skinvive,Skinvive,Skinvive,brand,스킨부스터 브랜드명
하이쥬|하이주|Hyaju|海珠,하이쥬,海珠,ハイジュ,Hyaju,Hyaju,Hyaju,Hyaju,brand,스킨부스터 브랜드명
더마샤인|더마신|Dermashine|德玛莎,더마샤인,德玛莎,ダーマシャイン,Dermashine,Dermashine,Dermashine,Dermashine,device,주사 기기명
스컬트라|Sculptra|塑颜翠|塑顏翠,스컬트라,塑颜翠,スカルプトラ,Sculptra,Sculptra,Sculptra,Sculptra,brand,콜라겐 부스터 브랜드명
피알피|PRP|혈청PRP|血清PRP,PRP,血清PRP,PRP,PRP,PRP,PRP,PRP,procedure,자가혈 스킨부스터
엘디엠|LDM,LDM,LDM,LDM,LDM,LDM,LDM,LDM,device,피부관리 장비명
에이치디에이|HDA,HDA,HDA,HDA,HDA,HDA,HDA,HDA,procedure,부위별 스킨부스터 시술명
슈링크유니버스|슈링크 유니버스|Shurink Universe|shurrink|舒丽科,슈링크 유니버스,Shurink Universe,シュリンクユニバース,Shurink Universe,Shurink Universe,Shurink Universe,Shurink Universe,device,HIFU 리프팅 장비명
레비나스|Revinas|체외충격파,레비나스,Revinas 体外冲击波,レヴィナス,Revinas shockwave,Revinas shockwave,Revinas shockwave,Revinas shockwave,device,장비명
온다|ONDA|온다리프팅|온다 리프팅|微波提升,온다,ONDA 微波提升,ONDA,ONDA microwave lifting,ONDA microwave lifting,ONDA microwave lifting,ONDA microwave lifting,device,장비명
브이로어드밴스|브이로 어드밴스|브이로리프팅|VRO Advance|V-RO ADVANCE,브이로 어드밴스,V-RO ADVANCE,V-RO ADVANCE,V-RO ADVANCE,V-RO ADVANCE,V-RO ADVANCE,V-RO ADVANCE,device,HIFU와 RF 복합 리프팅 장비명
미라클잡티클리닉|미라클 잡티 클리닉|Miracle Spot Clinic|奇迹淡斑诊所,미라클 잡티 클리닉,奇迹淡斑诊所,ミラクルスポットクリニック,Miracle Spot Clinic,Miracle Spot Clinic,Miracle Spot Clinic,Miracle Spot Clinic,procedure,색소 시술명
듀얼프락셀|듀얼 프락셀|Fraxel Dual|双效飞梭,듀얼 프락셀,双效飞梭,フラクセルデュアル,Fraxel Dual,Fraxel Dual,Fraxel Dual,Fraxel Dual,device,프락셔널 레이저 장비명
씨앤비토닝|C+B토닝|C+B 토닝|C+B Toning Laser|C+B 素颜光,씨앤비 토닝,C+B 素颜光,C+Bトーニング,C+B toning laser,C+B toning laser,C+B toning laser,C+B toning laser,procedure,색소 레이저 시술명
프락셔널레이저스탬프PDRN|프락셔널 레이저 스탬프 PDRN|Fractional laser stamp PDRN|飞梭激光 stamp PDRN,프락셔널 레이저 스탬프 PDRN,飞梭激光+stamp+PDRN,フラクショナルレーザー stamp PDRN,Fractional laser stamp PDRN,Fractional laser stamp PDRN,Fractional laser stamp PDRN,Fractional laser stamp PDRN,procedure,스킨부스터 병합 시술명
리즈톡스|Liztox,리즈톡스,Liztox,Liztox,Liztox,Liztox,Liztox,Liztox,brand,보툴리눔 톡신 브랜드명
디스포트|Dysport,디스포트,Dysport,Dysport,Dysport,Dysport,Dysport,Dysport,brand,보툴리눔 톡신 브랜드명
제오민|Xeomin,제오민,Xeomin,ゼオミン,Xeomin,Xeomin,Xeomin,Xeomin,brand,보툴리눔 톡신 브랜드명
앨러간|알러간|Allergan,앨러간,Allergan,アラガン,Allergan,Allergan,Allergan,Allergan,brand,보툴리눔 톡신 브랜드명
브이라인보톡스|브이라인 보톡스|V라인 보톡스|V-Line Botox|V脸肉毒素,브이라인 보톡스,V脸肉毒素,Vラインボトックス,V-line Botox,V-line Botox,V-line Botox,V-line Botox,procedure,윤곽 보톡스 시술명
풀페이스보톡스|풀페이스 보톡스|Full Face Botox|스킨보톡스,풀페이스 보톡스,全脸肉毒素,フルフェイスボトックス,full face Botox,full face Botox,full face Botox,full face Botox,procedure,보톡스 시술명
사각턱보톡스|사각턱 보톡스|Masseter Botox|咬肌肉毒素,사각턱 보톡스,咬肌肉毒素,エラボトックス,masseter Botox,masseter Botox,masseter Botox,masseter Botox,procedure,보톡스 부위명
침샘보톡스|침샘 보톡스|Salivary Gland Botox|腮腺肉毒素,침샘 보톡스,腮腺肉毒素,唾液腺ボトックス,salivary gland Botox,salivary gland Botox,salivary gland Botox,salivary gland Botox,procedure,보톡스 부위명
승모근보톡스|승모근 보톡스|Trapezius Botox,승모근 보톡스,斜方肌肉毒素,僧帽筋ボトックス,trapezius Botox,trapezius Botox,trapezius Botox,trapezius Botox,procedure,보톡스 부위명
종아리보톡스|종아리 보톡스|Calf Botox|瘦腿针,종아리 보톡스,瘦腿针,ふくらはぎボトックス,calf Botox,calf Botox,calf Botox,calf Botox,procedure,보톡스 부위명
다한증보톡스|다한증 보톡스|Hyperhidrosis Botox|多汗症肉毒素,다한증 보톡스,多汗症肉毒素,多汗症ボトックス,hyperhidrosis Botox,hyperhidrosis Botox,hyperhidrosis Botox,hyperhidrosis Botox,procedure,보톡스 부위명
블랙필|Black Peel|黑醋护理,블랙필,黑醋护理,ブラックピール,Black Peel,Black Peel,Black Peel,Black Peel,procedure,피부관리 시술명
아쿠아필|Aqua Peel|小气泡,아쿠아필,小气泡,アクアピール,Aqua Peel,Aqua Peel,Aqua Peel,Aqua Peel,procedure,피부관리 시술명
라라필|LHALA Peel|라라 필|第五代刷酸,라라필,第五代刷酸,ララピール,LHALA Peel,LHALA Peel,LHALA Peel,LHALA Peel,procedure,피부관리 시술명
물톡필|Mooltok Peel|물톡 필|第五代刷酸,물톡필,第五代刷酸,ムルトックピール,Mooltok Peel,Mooltok Peel,Mooltok Peel,Mooltok Peel,procedure,피부관리 시술명
핑크필|Pink Peel|핑크 필|第五代刷酸,핑크필,第五代刷酸,ピンクピール,Pink Peel,Pink Peel,Pink Peel,Pink Peel,procedure,피부관리 시술명
산소필|Oxygen Peel|산소 필|第五代刷酸,산소필,第五代刷酸,酸素ピール,Oxygen Peel,Oxygen Peel,Oxygen Peel,Oxygen Peel,procedure,피부관리 시술명
예스필|Yes Peel|예스 필|第五代刷酸,예스필,第五代刷酸,イエスピール,Yes Peel,Yes Peel,Yes Peel,Yes Peel,procedure,피부관리 시술명
소노스타일러|Sono Styler|초음파관리|超声波护理,소노스타일러,超声波护理,Sono Styler,Sono Styler,Sono Styler,Sono Styler,Sono Styler,device,피부관리 장비명
테라클리어|Theraclear,테라클리어,Theraclear,Theraclear,Theraclear,Theraclear,Theraclear,Theraclear,device,여드름 관리 장비명
여드름압출관리|여드름 압출 관리|痘痘针清管理,여드름 압출 관리,痘痘针清管理,ニキビ圧出管理,acne extraction care,acne extraction care,acne extraction care,acne extraction care,procedure,피부관리 시술명
고탄력관리|고탄력 관리|BTS관리|BTS 관리|高弹力护理,고탄력 관리,高弹力护理,高弾力ケア,high-elasticity care,high-elasticity care,high-elasticity care,high-elasticity care,procedure,피부관리 시술명
리쥬란|리주란|미주란|三文鱼针|三文魚針,리쥬란,丽珠兰,リジュラン,Rejuran,Rejuran,Rejuran,Rejuran,brand,브랜드명
켈로이드|켄루이드,켈로이드,瘢痕疙瘩,ケロイド,keloid,келоид,sẹo lồi,keloid,medical,의학용어
리쥬란힐러|리쥬란 힐러,리쥬란 힐러,丽珠兰 Healer,リジュランヒーラー,Rejuran Healer,Rejuran Healer,Rejuran Healer,Rejuran Healer,brand,브랜드명
리쥬란블랙박스|리쥬란 블랙박스|리쥬란 블랙 박스|리쥬란 힐러|블랙박스|블랙 박스|黑盒|黑盒子|黑火|黑河|黑和|黑合|黑核|灰盒|灰火|헤이허|헤이훠|훼이훠|heihe|hei he|hei huo|black box|black fire,리쥬란 힐러,丽珠兰 Healer,リジュランヒーラー,Rejuran Healer,Rejuran Healer,Rejuran Healer,Rejuran Healer,brand,리쥬란 제품 색상 별칭은 입력 인식용이고 출력은 공식 제품명
리쥬란레드박스|리쥬란 레드박스|리쥬란 레드 박스|리쥬란 HB|리쥬란 에이치비|레드박스|레드 박스|红盒|紅盒|红盒子|紅盒子|红火|紅火|红河|紅河|红和|紅和|红合|紅合|红货|紅貨|洪盒|宏盒|홍허|홍훠|honghe|hong he|hong huo|red box|red fire,리쥬란 HB,丽珠兰 HB,リジュランHB,Rejuran HB,Rejuran HB,Rejuran HB,Rejuran HB,brand,리쥬란 제품 색상 별칭은 입력 인식용이고 출력은 공식 제품명
리쥬란화이트박스|리쥬란 화이트박스|리쥬란 화이트 박스|리쥬란 아이|아이리쥬란|리쥬란 I|화이트박스|화이트 박스|白盒|白盒子|白火|白和|白合|百河|바이허|바이훠|baihe|bai he|bai huo|white box|white fire,리쥬란 아이,丽珠兰 I,リジュラン アイ,Rejuran I,Rejuran I,Rejuran I,Rejuran I,brand,리쥬란 눈가 제품 색상 별칭은 입력 인식용이고 출력은 공식 제품명
리쥬란블루박스|리쥬란 블루박스|리쥬란 블루 박스|리쥬란 S|리쥬란 에스|블루박스|블루 박스|蓝盒|藍盒|蓝盒子|藍盒子|蓝火|藍火|蓝和|藍和|蓝合|藍合|란허|란훠|lanhe|lan he|lan huo|blue box|blue fire,리쥬란 S,丽珠兰 S,リジュランS,Rejuran S,Rejuran S,Rejuran S,Rejuran S,brand,리쥬란 흉터 제품 색상 별칭은 입력 인식용이고 출력은 공식 제품명
리쥬란퍼플박스|리쥬란 퍼플박스|리쥬란 퍼플 박스|리쥬란 엘라스킨|엘라스킨|퍼플박스|퍼플 박스|紫盒|紫盒子|紫火|紫和|紫合|즈허|즈훠|zihe|zi he|zi huo|purple box|purple fire,리쥬란 엘라스킨,丽珠兰 Elaskin,リジュラン エラスキン,Rejuran Elaskin,Rejuran Elaskin,Rejuran Elaskin,Rejuran Elaskin,brand,리쥬란 제품 색상 별칭은 입력 인식용이고 출력은 공식 제품명
쥬베룩|주베룩|乔雅露|喬雅露|乔雅路|喬雅路|朱韦洛克|朱維洛克|朱维洛克,쥬베룩,Juvelook,ジュベルック,Juvelook,Juvelook,Juvelook,Juvelook,brand,브랜드명
쥬베룩볼륨|쥬베룩 볼륨,쥬베룩 볼륨,Juvelook Volume,ジュベルック ボリューム,Juvelook Volume,Juvelook Volume,Juvelook Volume,Juvelook Volume,brand,브랜드명
스킨부스터|스킨 부스터,스킨부스터,皮肤营养注射,スキンブースター,skin booster,скинбустер,skin booster,skin booster,procedure,시술명
보톡스|보툴리눔톡신,보툴리눔 톡신,肉毒素注射,ボツリヌストキシン注射,botulinum toxin injection,инъекция ботулотоксина,tiêm botulinum toxin,suntikan botulinum toxin,procedure,보톡스는 일반명처럼 쓰이지만 출력은 보툴리눔 톡신 권장
필러|히알루론산필러,필러,玻尿酸填充,ヒアルロン酸注入,dermal filler,филлер,tiêm filler,filler,procedure,필러
눈밑필러|눈 밑 필러|다크서클필러|눈밑꺼짐필러,눈밑 필러,泪沟填充,目の下フィラー,under-eye filler,under-eye filler,under-eye filler,under-eye filler,procedure,눈 밑 필러
지방분해주사|지방 분해 주사|브이라인주사,지방분해 주사,溶脂针,脂肪溶解注射,lipolysis injection,lipolysis injection,lipolysis injection,lipolysis injection,procedure,지방분해 주사
윤곽주사|윤곽 주사,윤곽주사,轮廓注射,輪郭注射,contour injection,контурная инъекция,tiêm thon gọn mặt,suntikan kontur wajah,procedure,시술명
인모드|인모드리프팅|钻石超塑|鑽石超塑|钻石雕塑|鑽石雕塑,인모드,InMode,インモード,InMode,InMode,InMode,InMode,device,장비명
슈링크|슈링크리프팅|韩版超声刀|韓版超聲刀|舒林克,슈링크,Shurink,シュリンク,Shurink,Shurink,Shurink,Shurink,device,장비명
초음파리프팅|초음파 리프팅|超声刀|超聲刀,초음파 리프팅,超声刀,HIFUリフティング,HIFU lifting,HIFU lifting,HIFU lifting,HIFU lifting,procedure,중국어 일반명은 특정 장비로 단정하지 않음
티타늄|티타늄리프팅,티타늄 리프팅,钛提升,チタニウムリフティング,titanium lifting,титановый лифтинг,nâng cơ titanium,titanium lifting,procedure,시술명
리프팅|리프팅시술,리프팅,提升治疗,リフティング施術,lifting treatment,лифтинг-процедура,liệu trình nâng cơ,perawatan lifting,procedure,시술명
토닝|레이저토닝,레이저 토닝,激光净肤,レーザートーニング,laser toning,лазерный тонинг,laser toning,laser toning,procedure,색소 시술
여드름흉터|여드름 흉터,여드름 흉터,痘坑和痘印,ニキビ跡,acne scars,рубцы после акне,sẹo mụn,bekas jerawat,condition,피부 상태
색소|색소침착,색소침착,色素沉着,色素沈着,pigmentation,пигментация,tăng sắc tố,pigmentasi,condition,피부 상태
홍조|안면홍조,홍조,泛红,赤み,redness,покраснение,đỏ da,kemerahan,condition,피부 상태
장미증|주사피부염|로사시아|rosacea,장미증,玫瑰痤疮,酒さ,rosacea,rosacea,rosacea,rosacea,condition,피부 상태
모공|모공,모공,毛孔,毛穴,pores,поры,lỗ chân lông,pori-pori,condition,피부 상태
잔주름|잔주름,잔주름,细纹,小じわ,fine lines,мелкие морщины,nếp nhăn nhỏ,garis halus,condition,피부 상태
탄력|피부탄력,피부 탄력,皮肤弹性,肌のハリ,skin elasticity,упругость кожи,độ đàn hồi da,elastisitas kulit,condition,피부 상태
시작할게요|들어갑니다,시작할게요,现在开始。,始めます。,We're starting now.,Начинаем.,Bắt đầu nhé.,Kita mulai sekarang.,procedure_phrase,시술 시작
움직이지마세요|움직이지 마세요|움직이면 안돼요|움직이시면 안돼요|움직이시면 안 돼요,움직이지 마세요,请不要动。,動かないでください。,Please don't move.,Пожалуйста не двигайтесь.,Vui lòng đừng cử động.,Tolong jangan bergerak.,safety_phrase,시술 중 안전
눈감고계세요|눈 감고 계세요|눈 감아보세요|눈 감아 보세요,눈 감고 계세요,请闭上眼睛。,目を閉じたままにしてください。,Please keep your eyes closed.,Пожалуйста держите глаза закрытыми.,Vui lòng nhắm mắt lại.,Tolong tetap tutup mata.,safety_phrase,눈성형/눈 주변 시술
눈뜨지마세요|눈 뜨지마세요|눈 뜨지 마세요|눈 뜨시면 안돼요|눈 뜨시면 안 돼요|눈 뜨면 안돼요|눈 뜨면 안 돼요,눈 뜨지 마세요,请不要睁眼。,目を開けないでください。,Please don't open your eyes.,Пожалуйста не открывайте глаза.,Vui lòng đừng mở mắt.,Tolong jangan buka mata.,safety_phrase,눈성형/눈 주변 시술
말하지마세요|말하지 마세요,말하지 마세요,请先不要说话。,今は話さないでください。,Please don't talk for now.,Пожалуйста пока не разговаривайте.,Vui lòng tạm thời đừng nói chuyện.,Tolong jangan bicara dulu.,safety_phrase,시술 중 안내
힘빼세요|힘 빼주세요,힘 빼주세요,请放松。,力を抜いてください。,Please relax.,Пожалуйста расслабьтесь.,Vui lòng thả lỏng.,Tolong rileks.,procedure_phrase,긴장 완화
숨편하게쉬세요|숨 편하게 쉬세요,숨 편하게 쉬세요,请自然呼吸。,楽に呼吸してください。,Please breathe normally.,Дышите спокойно.,Hãy thở bình thường.,Silakan bernapas seperti biasa.,procedure_phrase,긴장 완화
고개돌려주세요|고개 돌려주세요,고개 돌려주세요,请把头转一下。,顔を少し横に向けてください。,Please turn your head a little.,Поверните голову немного в сторону.,Vui lòng quay đầu một chút.,Tolong putar kepala sedikit.,procedure_phrase,자세 안내
고개올려주세요|고개 살짝 올려주세요,고개 살짝 올려주세요,请稍微抬一下头。,あごを少し上げてください。,Please lift your chin slightly.,Слегка поднимите подбородок.,Vui lòng nâng cằm lên một chút.,Tolong angkat dagu sedikit.,procedure_phrase,자세 안내
턱당겨주세요|턱 당겨주세요,턱 당겨주세요,请把下巴稍微收一下。,あごを少し引いてください。,Please tuck your chin slightly.,Слегка опустите подбородок.,Vui lòng thu cằm lại một chút.,Tolong tundukkan dagu sedikit.,procedure_phrase,자세 안내
반대쪽할게요|반대쪽 들어갑니다,반대쪽 할게요,现在做另一侧。,反対側を行います。,We'll do the other side now.,Теперь сделаем другую сторону.,Bây giờ làm bên còn lại.,Sekarang bagian sisi lainnya.,procedure_phrase,시술 진행
한번더들어갑니다|한 번 더 들어갑니다,한 번 더 들어갑니다,再来一次。,もう一度行います。,One more time.,Еще один раз.,Thêm một lần nữa.,Sekali lagi.,procedure_phrase,반복 안내
거의끝났어요|거의 끝났습니다,거의 끝났어요,快结束了。,もう少しで終わります。,Almost done.,Почти закончили.,Sắp xong rồi.,Hampir selesai.,procedure_phrase,마무리
끝났습니다|끝났어요,끝났습니다,结束了。,終わりました。,We're done.,Готово.,Xong rồi.,Sudah selesai.,procedure_phrase,종료
딱지떼지마세요|딱지 떼지 마세요|딱지를 떼지 마세요|딱지 만지지 마세요,딱지 떼지 마세요,不要抠痂。,かさぶたを無理に剥がさないでください。,Do not pick the scab.,Не сдирайте корочку.,Không bóc vảy.,Jangan mengelupas keropeng.,aftercare,레이저 후 주의
차가울수있어요|차가워요,차가울 수 있어요,会有点凉。,少し冷たく感じます。,It may feel cold.,Может быть немного холодно.,Có thể hơi lạnh.,Mungkin terasa dingin.,sensation,감각 안내
따끔할수있어요|따끔해요,따끔할 수 있어요,可能会有点刺痛。,少しチクッとします。,It may sting a little.,Может немного покалывать.,Có thể hơi châm chích.,Mungkin terasa sedikit perih.,sensation,감각 안내
뜨거울수있어요|뜨거워요,뜨거울 수 있어요,可能会有点热。,少し熱く感じることがあります。,It may feel a little hot.,Может быть немного горячо.,Có thể hơi nóng.,Mungkin terasa agak panas.,sensation,감각 안내
아플수있어요|살짝 아플 수 있어요|조금 아플 수 있어요|약간 아플 수 있어요,조금 아플 수 있어요,可能会有一点疼。,少し痛みを感じることがあります。,It may hurt a little.,Может быть немного больно.,Có thể hơi đau một chút.,Mungkin terasa sedikit sakit.,sensation,통증 안내
진동느껴질수있어요|진동이 느껴질 수 있어요,진동이 느껴질 수 있어요,可能会感觉到震动。,振動を感じることがあります。,You may feel some vibration.,Вы можете почувствовать вибрацию.,Có thể cảm thấy rung nhẹ.,Mungkin terasa ada getaran.,sensation,감각 안내
압박감있을수있어요|압박감이 있을 수 있어요,압박감이 있을 수 있어요,可能会有压迫感。,圧迫感を感じることがあります。,You may feel some pressure.,Может ощущаться давление.,Có thể có cảm giác bị ấn.,Mungkin terasa seperti ditekan.,sensation,감각 안내
참기힘들면말씀해주세요|아프면 말씀해주세요,아프면 말씀해주세요,如果疼请告诉我。,痛かったら教えてください。,Please let me know if it hurts.,Если больно скажите мне.,Nếu đau hãy nói với tôi.,Kalau sakit beri tahu saya.,safety_phrase,통증 확인
아프지않으세요|아프지 않으세요|아프세요|아픈가요|아프지 않나요,아프지 않으세요?,疼吗？,痛くないですか？,Does it hurt?,Больно?,Có đau không?,Apakah sakit?,check_phrase,통증 확인
괜찮으세요|괜찮으세요?,괜찮으세요?,还好吗？,大丈夫ですか？,Are you okay?,Вы в порядке?,Bạn ổn chứ?,Apakah Anda baik-baik saja?,check_phrase,상태 확인
통증은어떠세요|통증은 어떠세요|통증 어떠세요|통증이 어떠세요|아픈 건 어떠세요,통증은 어떠세요?,疼痛怎么样？,痛みはどうですか？,How is the pain?,Как боль?,Cơn đau thế nào?,Bagaimana rasa sakitnya?,check_phrase,통증 확인
통증몇점이에요|통증 몇 점이에요?,통증은 어느 정도인가요?,疼痛程度是多少？,痛みはどのくらいですか？,How strong is the pain?,Насколько сильная боль?,Mức độ đau thế nào?,Seberapa kuat rasa sakitnya?,check_phrase,통증 확인
젤바를게요|젤 바르겠습니다,젤 바를게요,现在涂凝胶。,ジェルを塗ります。,I'll apply the gel now.,Сейчас нанесу гель.,Tôi sẽ thoa gel.,Saya akan mengoleskan gel.,procedure_phrase,초음파/RF 시술
소독할게요|소독하겠습니다,소독할게요,现在消毒。,消毒します。,I'll disinfect the area now.,Сейчас обработаю антисептиком.,Tôi sẽ sát khuẩn vùng này.,Saya akan membersihkan dengan antiseptic.,procedure_phrase,소독
마취크림닦을게요|마취크림 닦겠습니다,마취크림 닦을게요,现在擦掉麻药膏。,麻酔クリームを拭き取ります。,I'll wipe off the numbing cream now.,Сейчас уберу обезболивающий крем.,Tôi sẽ lau kem tê.,Saya akan membersihkan krim anestesi.,procedure_phrase,마취크림
냉찜질할게요|차갑게 할게요,냉찜질할게요,现在冷敷。,冷やします。,I'll cool the area now.,Сейчас охладим область.,Tôi sẽ chườm lạnh.,Saya akan kompres dingin.,procedure_phrase,쿨링
연고바를게요|연고 발라드릴게요,연고 발라드릴게요,现在涂药膏。,軟膏を塗ります。,I'll apply ointment now.,Сейчас нанесу мазь.,Tôi sẽ bôi thuốc mỡ.,Saya akan mengoleskan salep.,procedure_phrase,마무리
재생크림바르세요|재생크림 발라주세요,재생크림 발라주세요,请涂修复霜。,再生クリームを塗ってください。,Please apply recovery cream.,Наносите восстанавливающий крем.,Vui lòng thoa kem phục hồi.,Silakan gunakan krim pemulihan.,aftercare,사후관리
선크림바르세요|자외선차단제 바르세요,자외선 차단제 바르세요,请涂防晒霜。,日焼け止めを塗ってください。,Please apply sunscreen.,Наносите солнцезащитный крем.,Vui lòng thoa kem chống nắng.,Silakan gunakan tabir surya.,aftercare,사후관리
오늘술드시면안돼요|오늘 음주하지 마세요,오늘 음주하지 마세요,今天请不要喝酒。,今日はお酒を飲まないでください。,Please don't drink alcohol today.,Сегодня не употребляйте алкоголь.,Hôm nay vui lòng không uống rượu bia.,Hari ini jangan minum alkohol.,aftercare,주의사항
오늘운동하지마세요|오늘 운동하지 마세요,오늘 운동하지 마세요,今天请不要运动。,今日は運動を控えてください。,Please don't exercise today.,Сегодня не занимайтесь спортом.,Hôm nay vui lòng không tập thể dục.,Hari ini jangan berolahraga.,aftercare,주의사항
사우나하지마세요|사우나 금지,사우나 하지 마세요,请不要去桑拿。,サウナは控えてください。,Please avoid the sauna.,Не посещайте сауну.,Vui lòng không đi xông hơi.,Hindari sauna.,aftercare,주의사항
찜질방가지마세요|찜질방 금지,찜질방 가지 마세요,请不要去汗蒸房。,チムジルバンは控えてください。,Please avoid hot baths and steam rooms.,Избегайте горячих бань и парных.,Vui lòng tránh phòng xông hơi nóng.,Hindari ruang uap dan mandi panas.,aftercare,주의사항
뜨거운물피하세요|뜨거운 물 피하세요,뜨거운 물 피하세요,请避免热水。,熱いお湯は避けてください。,Please avoid hot water.,Избегайте горячей воды.,Vui lòng tránh nước nóng.,Hindari air panas.,aftercare,주의사항
강한마사지하지마세요|마사지하지 마세요,강한 마사지 하지 마세요,请不要用力按摩。,強いマッサージはしないでください。,Please don't massage the area strongly.,Не массируйте область сильно.,Vui lòng không massage mạnh vùng này.,Jangan memijat area ini terlalu kuat.,aftercare,주의사항
각질제거하지마세요|각질 제거 금지,각질 제거하지 마세요,请不要去角质。,角質ケアは控えてください。,Please don't exfoliate.,Не используйте средства для отшелушивания.,Vui lòng không tẩy tế bào chết.,Jangan eksfoliasi.,aftercare,주의사항
레티놀중단하세요|레티놀 쉬세요,레티놀은 잠시 중단하세요,请暂时停用视黄醇。,レチノールはしばらく控えてください。,Please stop using retinol for a while.,Временно прекратите использовать ретинол.,Vui lòng tạm ngưng retinol.,Hentikan retinol sementara.,aftercare,주의사항
화장은내일부터하세요|화장은 내일부터 하세요,화장은 내일부터 하세요,请从明天开始化妆。,メイクは明日からにしてください。,Please wear makeup starting tomorrow.,Макияж лучше делать с завтрашнего дня.,Vui lòng trang điểm từ ngày mai.,Silakan memakai makeup mulai besok.,aftercare,주의사항
세안은오늘가능해요|오늘 세안 가능해요,오늘 세안 가능해요,今天可以洗脸。,今日は洗顔できます。,You can wash your face today.,Сегодня можно умываться.,Hôm nay có thể rửa mặt.,Hari ini boleh mencuci wajah.,aftercare,주의사항
붓기있을수있어요|부을 수 있어요,붓기가 있을 수 있어요,可能会有肿胀。,腫れが出ることがあります。,Swelling may occur.,Может появиться отек.,Có thể bị sưng.,Bisa terjadi bengkak.,side_effect,일반 반응
멍들수있어요|멍이 들 수 있어요,멍이 들 수 있어요,可能会有淤青。,内出血が出ることがあります。,Bruising may occur.,Может появиться синяк.,Có thể bị bầm tím.,Bisa terjadi memar.,side_effect,일반 반응
붉어질수있어요|붉은기 있을 수 있어요,붉은기가 있을 수 있어요,可能会有泛红。,赤みが出ることがあります。,Redness may occur.,Может появиться покраснение.,Có thể bị đỏ da.,Bisa terjadi kemerahan.,side_effect,일반 반응
따가울수있어요|따가움 있을 수 있어요,따가움이 있을 수 있어요,可能会有刺痛感。,ヒリヒリすることがあります。,You may feel some stinging.,Может быть ощущение жжения или покалывания.,Có thể có cảm giác châm chích.,Bisa terasa perih.,side_effect,일반 반응
건조할수있어요|건조함 있을 수 있어요,건조함이 있을 수 있어요,可能会感觉干燥。,乾燥を感じることがあります.,Your skin may feel dry.,Кожа может стать сухой.,Da có thể bị khô.,Kulit bisa terasa kering.,side_effect,일반 반응
딱지생길수있어요|딱지가 생길 수 있어요,딱지가 생길 수 있어요,可能会结痂。,かさぶたができることがあります。,Scabs may form.,Могут появиться корочки.,Có thể hình thành vảy nhỏ.,Bisa muncul keropeng kecil.,side_effect,레이저 후 반응
가려울수있어요|가려움 있을 수 있어요,가려움이 있을 수 있어요,可能会有瘙痒感。,かゆみが出ることがあります。,Itching may occur.,Может появиться зуд.,Có thể bị ngứa.,Bisa terasa gatal.,side_effect,일반 반응
일시적인반응이에요|일시적인 반응입니다,일시적인 반응입니다,这是暂时反应。,一時的な反応です。,This is temporary.,Это временная реакция.,Đây là phản ứng tạm thời.,Ini reaksi sementara.,side_effect,안심 안내
당일,당일,当天,当日,the same day,в тот же день,trong ngày,hari yang sama,time,시간
내일,내일,明天,明日,tomorrow,завтра,ngày mai,besok,time,시간
이삼일|2~3일,2~3일,两到三天,二、三日,two to three days,два-три дня,hai đến ba ngày,dua sampai tiga hari,time,기간
삼사일|3~4일,3~4일,三到四天,三、四日,three to four days,три-четыре дня,ba đến bốn ngày,tiga sampai empat hari,time,기간
일주일|1주일,1주일,一周,一週間,one week,одна неделя,một tuần,satu minggu,time,기간
이주일|2주일,2주일,两周,二週間,two weeks,две недели,hai tuần,dua minggu,time,기간
한달|1개월,1개월,一个月,一か月,one month,один месяц,một tháng,satu bulan,time,기간
삼개월|3개월,3개월,三个月,三か月,three months,три месяца,ba tháng,tiga bulan,time,기간
육개월|6개월,6개월,六个月,六か月,six months,шесть месяцев,sáu tháng,enam bulan,time,기간
일년|1년,1년,一年,一年,one year,один год,một năm,satu tahun,time,기간
이마,이마,额头,額,forehead,лоб,trán,dahi,body_part,부위
미간,미간,眉间,眉間,between the eyebrows,межбровье,vùng giữa hai lông mày,area antara alis,body_part,부위
눈가,눈가,眼周,目元,around the eyes,область вокруг глаз,vùng quanh mắt,area sekitar mata,body_part,부위
볼,볼,脸颊,頬,cheeks,щеки,má,pipi,body_part,부위
팔자,팔자주름,法令纹,ほうれい線,nasolabial folds,носогубные складки,rãnh mũi má,lipatan nasolabial,body_part,부위
입가,입가,嘴角周围,口元,around the mouth,область вокруг рта,vùng quanh miệng,area sekitar mulut,body_part,부위
턱,턱,下巴,あご,chin,подбородок,cằm,dagu,body_part,부위
턱선,턱선,下颌线,フェイスライン,jawline,линия нижней челюсти,đường viền hàm,garis rahang,body_part,부위
목,목,颈部,首,neck,шея,cổ,leher,body_part,부위
전체얼굴|얼굴전체,얼굴 전체,全脸,全顔,full face,все лицо,toàn mặt,seluruh wajah,body_part,부위
`;

function parseClinicGlossary(): ClinicGlossaryEntry[] {
  return rawClinicGlossary
    .trim()
    .split("\n")
    .map((line) => {
      const [spoken, standardKo, zh, ja, en, ru, vi, id, category, note] = line.split(",");
      return {
        spoken: spoken.split("|").map((item) => item.trim()).filter(Boolean),
        standardKo: standardKo.trim(),
        zh: zh.trim(),
        ja: ja.trim(),
        en: en.trim(),
        ru: ru.trim(),
        vi: vi.trim(),
        id: id.trim(),
        category: category.trim(),
        note: note.trim()
      };
    });
}

export const clinicGlossary = parseClinicGlossary();

export const criticalShortPhrases: CriticalShortPhrase[] = [
  {
    spoken: ["아프지않으세요", "아프지 않으세요", "아프세요", "아픈가요", "아프지 않나요", "안 아프세요"],
    translations: {
      ko: "아프지 않으세요?",
      zh: "疼吗？",
      zh_tw: "會痛嗎？",
      ja: "痛くないですか？",
      en: "Does it hurt?",
      th: "เจ็บไหม?",
      ms: "Sakit tak?",
      mn: "Өвдөж байна уу?",
      ru: "Больно?",
      vi: "Có đau không?",
      id: "Apakah sakit?",
      fr: "Est-ce que cela fait mal ?",
      es: "¿Le duele?",
      de: "Tut es weh?",
      it: "Fa male?",
      pt: "Dói?"
    },
    note: "통증 여부 확인"
  },
  {
    spoken: ["통증은어떠세요", "통증은 어떠세요", "통증 어떠세요", "통증이 어떠세요", "아픈 건 어떠세요", "아픈건 어떠세요"],
    translations: {
      ko: "통증은 어떠세요?",
      zh: "疼痛怎么样？",
      zh_tw: "疼痛感覺怎麼樣？",
      ja: "痛みはどうですか？",
      en: "How is the pain?",
      th: "อาการปวดเป็นอย่างไรบ้าง?",
      ms: "Bagaimana rasa sakitnya?",
      mn: "Өвдөлт ямар байна?",
      ru: "Как боль?",
      vi: "Cơn đau thế nào?",
      id: "Bagaimana rasa sakitnya?",
      fr: "Comment est la douleur ?",
      es: "¿Cómo está el dolor?",
      de: "Wie sind die Schmerzen?",
      it: "Com'è il dolore?",
      pt: "Como está a dor?"
    },
    note: "통증 정도 확인"
  },
  {
    spoken: ["괜찮으세요", "괜찮으세요?"],
    translations: {
      ko: "괜찮으세요?",
      zh: "还好吗？",
      zh_tw: "還好嗎？",
      ja: "大丈夫ですか？",
      en: "Are you okay?",
      th: "คุณโอเคไหม?",
      ms: "Anda okey?",
      mn: "Та зүгээр үү?",
      ru: "Вы в порядке?",
      vi: "Bạn ổn chứ?",
      id: "Apakah Anda baik-baik saja?",
      fr: "Est-ce que ça va ?",
      es: "¿Está bien?",
      de: "Geht es Ihnen gut?",
      it: "Va tutto bene?",
      pt: "Está tudo bem?"
    },
    note: "상태 확인"
  },
  {
    spoken: ["참기힘들면말씀해주세요", "참기 힘들면 말씀해주세요", "아프면 말씀해주세요", "힘들면 말씀해주세요"],
    translations: {
      ko: "아프면 말씀해주세요.",
      zh: "如果疼请告诉我。",
      zh_tw: "如果會痛請告訴我。",
      ja: "痛かったら教えてください。",
      en: "Please let me know if it hurts.",
      th: "ถ้าเจ็บกรุณาบอกฉันนะคะ",
      ms: "Jika sakit, sila beritahu saya.",
      mn: "Өвдвөл надад хэлээрэй.",
      ru: "Если больно скажите мне.",
      vi: "Nếu đau hãy nói với tôi.",
      id: "Kalau sakit beri tahu saya.",
      fr: "Dites-moi si vous avez mal.",
      es: "Dígame si le duele.",
      de: "Sagen Sie mir bitte wenn es weh tut.",
      it: "Mi dica se fa male.",
      pt: "Avise-me se doer."
    },
    note: "통증 알림 요청"
  },
  {
    spoken: ["움직이지마세요", "움직이지 마세요", "움직이면 안돼요", "움직이면 안 돼요", "움직이시면 안돼요", "움직이시면 안 돼요"],
    translations: {
      ko: "움직이지 마세요.",
      zh: "请不要动。",
      zh_tw: "請不要動。",
      ja: "動かないでください。",
      en: "Please don't move.",
      th: "กรุณาอย่าขยับ",
      ms: "Tolong jangan bergerak.",
      mn: "Битгий хөдлөөрэй.",
      ru: "Пожалуйста не двигайтесь.",
      vi: "Vui lòng đừng cử động.",
      id: "Tolong jangan bergerak.",
      fr: "Ne bougez pas s'il vous plaît.",
      es: "Por favor no se mueva.",
      de: "Bitte bewegen Sie sich nicht.",
      it: "Per favore non si muova.",
      pt: "Por favor não se mexa."
    },
    note: "시술 중 안전"
  },
  {
    spoken: ["눈감고계세요", "눈 감고 계세요", "눈 감아보세요", "눈 감아 보세요", "눈 감아주세요", "눈 감아 주세요"],
    translations: {
      ko: "눈 감고 계세요.",
      zh: "请闭上眼睛。",
      zh_tw: "請閉上眼睛。",
      ja: "目を閉じたままにしてください。",
      en: "Please keep your eyes closed.",
      th: "กรุณาหลับตาไว้",
      ms: "Sila tutup mata.",
      mn: "Нүдээ аниад байгаарай.",
      ru: "Пожалуйста держите глаза закрытыми.",
      vi: "Vui lòng nhắm mắt lại.",
      id: "Tolong tetap tutup mata.",
      fr: "Gardez les yeux fermés s'il vous plaît.",
      es: "Mantenga los ojos cerrados por favor.",
      de: "Bitte halten Sie die Augen geschlossen.",
      it: "Tenga gli occhi chiusi per favore.",
      pt: "Mantenha os olhos fechados por favor."
    },
    note: "눈성형/눈 주변 시술"
  },
  {
    spoken: ["눈뜨지마세요", "눈 뜨지마세요", "눈 뜨지 마세요", "눈 뜨시면 안돼요", "눈 뜨시면 안 돼요", "눈 뜨면 안돼요", "눈 뜨면 안 돼요"],
    translations: {
      ko: "눈 뜨지 마세요.",
      zh: "请不要睁眼。",
      zh_tw: "請不要睜開眼睛。",
      ja: "目を開けないでください。",
      en: "Please don't open your eyes.",
      th: "กรุณาอย่าลืมตา",
      ms: "Sila jangan buka mata.",
      mn: "Нүдээ битгий нээгээрэй.",
      ru: "Пожалуйста не открывайте глаза.",
      vi: "Vui lòng đừng mở mắt.",
      id: "Tolong jangan buka mata.",
      fr: "N'ouvrez pas les yeux s'il vous plaît.",
      es: "No abra los ojos por favor.",
      de: "Bitte öffnen Sie die Augen nicht.",
      it: "Non apra gli occhi per favore.",
      pt: "Não abra os olhos por favor."
    },
    note: "눈성형/눈 주변 시술"
  },
  {
    spoken: ["아플수있어요", "살짝 아플 수 있어요", "조금 아플 수 있어요", "약간 아플 수 있어요", "좀 아플 수 있어요"],
    translations: {
      ko: "조금 아플 수 있어요.",
      zh: "可能会有一点疼。",
      zh_tw: "可能會有一點痛。",
      ja: "少し痛みを感じることがあります。",
      en: "It may hurt a little.",
      th: "อาจเจ็บเล็กน้อย",
      ms: "Mungkin sakit sedikit.",
      mn: "Бага зэрэг өвдөж магадгүй.",
      ru: "Может быть немного больно.",
      vi: "Có thể hơi đau một chút.",
      id: "Mungkin terasa sedikit sakit.",
      fr: "Cela peut faire un peu mal.",
      es: "Puede doler un poco.",
      de: "Es kann ein wenig weh tun.",
      it: "Potrebbe fare un po' male.",
      pt: "Pode doer um pouco."
    },
    note: "눈성형/통증 사전 안내"
  }
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function brandDisplay(targetLanguage: GlossaryTargetLanguage, key: ClinicBrandKey) {
  return brandDisplayByLanguage[targetLanguage]?.[key] ?? {
    rejuran: "Rejuran",
    rejuranHealer: "Rejuran Healer",
    rejuranHb: "Rejuran HB",
    rejuranI: "Rejuran I",
    rejuranS: "Rejuran S",
    rejuranElaskin: "Rejuran Elaskin",
    juvelook: "Juvelook",
    juvelookVolume: "Juvelook Volume",
    re2o: "Re2O"
  }[key];
}

function applyHighPriorityClinicCorrections(text: string, targetLanguage: GlossaryTargetLanguage) {
  let corrected = text;
  const rejuranReplacement = brandDisplay(targetLanguage, "rejuran");
  const rejuranHealerReplacement = brandDisplay(targetLanguage, "rejuranHealer");
  const rejuranHbReplacement = brandDisplay(targetLanguage, "rejuranHb");
  const rejuranIReplacement = brandDisplay(targetLanguage, "rejuranI");
  const rejuranSReplacement = brandDisplay(targetLanguage, "rejuranS");
  const rejuranElaskinReplacement = brandDisplay(targetLanguage, "rejuranElaskin");
  const juvelookReplacement = brandDisplay(targetLanguage, "juvelook");
  const juvelookVolumeReplacement = brandDisplay(targetLanguage, "juvelookVolume");
  const re2oReplacement = brandDisplay(targetLanguage, "re2o");
  const swellingTerm = swellingTermByLanguage[targetLanguage] ?? "swelling";
  const swellingPhrase = swellingPhraseByLanguage[targetLanguage] ?? "Swelling may occur.";

  corrected = corrected
    .replace(/(?:세\s*르\s*프|제\s*르\s*프|\bXERF\b)(?:\s*(?:리프팅|시술))?|셀\s*프\s*(?:리프팅|시술)|\bself\s*(?:lifting|procedure|treatment)\b/gi, "XERF")
    .replace(/(?:리\s*[쥬주]\s*란|니\s*[쥬주]\s*란|리.{0,3}란|Rejuran|丽珠兰|麗珠蘭|リジュラン)?\s*(?:힐러|블랙\s*박스|블랙박스|黑盒子?|黑火|黑河|黑和|黑合|黑核|灰盒|灰火|black\s*(?:box|fire))|\b(?:re|ni|nizhu|niju)[\s-]?juran\s*(?:healer|black\s*box)\b/gi, rejuranHealerReplacement)
    .replace(/(?:리\s*[쥬주]\s*란|니\s*[쥬주]\s*란|리.{0,3}란|Rejuran|丽珠兰|麗珠蘭|リジュラン)\s*(?:HB|에이치비|레드\s*박스|레드박스|红盒子?|紅盒子?|红火|紅火|red\s*box)|(?:레드\s*박스|레드박스|红盒子?|紅盒子?|红火|紅火|红河|紅河|红和|紅和|红合|紅合|红货|紅貨|洪盒|宏盒|red\s*(?:box|fire))|\b(?:re|ni|nizhu|niju)[\s-]?juran\s*(?:hb|red\s*box)\b/gi, rejuranHbReplacement)
    .replace(/(?:리\s*[쥬주]\s*란|니\s*[쥬주]\s*란|리.{0,3}란|Rejuran|丽珠兰|麗珠蘭|リジュラン)\s*(?:I\b|아이|화이트\s*박스|화이트박스|白盒子?|白火|white\s*box)|(?:아이리쥬란|화이트\s*박스|화이트박스|白盒子?|白火|白和|白合|百河|white\s*(?:box|fire))|\b(?:re|ni|nizhu|niju)[\s-]?juran\s*(?:i\b|eye|white\s*box)\b/gi, rejuranIReplacement)
    .replace(/(?:리\s*[쥬주]\s*란|니\s*[쥬주]\s*란|리.{0,3}란|Rejuran|丽珠兰|麗珠蘭|リジュラン)\s*(?:S\b|에스|블루\s*박스|블루박스|蓝盒子?|藍盒子?|蓝火|藍火|blue\s*box)|(?:블루\s*박스|블루박스|蓝盒子?|藍盒子?|蓝火|藍火|蓝和|藍和|蓝合|藍合|blue\s*(?:box|fire))|\b(?:re|ni|nizhu|niju)[\s-]?juran\s*(?:s\b|blue\s*box)\b/gi, rejuranSReplacement)
    .replace(/(?:리\s*[쥬주]\s*란|니\s*[쥬주]\s*란|리.{0,3}란|Rejuran|丽珠兰|麗珠蘭|リジュラン)\s*(?:엘라스킨|퍼플\s*박스|퍼플박스|紫盒子?|紫火|purple\s*box)|(?:엘라스킨|퍼플\s*박스|퍼플박스|紫盒子?|紫火|紫和|紫合|purple\s*(?:box|fire))|\b(?:re|ni|nizhu|niju)[\s-]?juran\s*(?:elaskin|purple\s*box)\b/gi, rejuranElaskinReplacement)
    .replace(/(?:쥬|주)\s*베\s*룩\s*볼륨|\bjuve[\s-]?look\s*volume\b/gi, juvelookVolumeReplacement)
    .replace(/(?:쥬|주)\s*베\s*룩|\bjuve[\s-]?look\b/gi, juvelookReplacement)
    .replace(/(?:리\s*투\s*(?:오|어)|리\s*트\s*오|알\s*이\s*투\s*오|\bRe\s*2\s*O\b)(?:\s*(?:주사|스킨\s*부스터|시술))?/gi, re2oReplacement);

  for (const officialVariant of [
    rejuranHealerReplacement,
    rejuranHbReplacement,
    rejuranIReplacement,
    rejuranSReplacement,
    rejuranElaskinReplacement
  ]) {
    corrected = corrected.replace(
      new RegExp(`${escapeRegExp(rejuranReplacement)}\\s+${escapeRegExp(officialVariant)}`, "gi"),
      officialVariant
    );
  }

  for (const pattern of commonBrandCorrectionPatterns) {
    corrected = corrected.replace(pattern, rejuranReplacement);
  }

  if (/^(?:그종|구종|붓종|geu[\s-]?jong|gu[\s-]?jong|geo[\s-]?jong)(?:[이가은는]?\s*)?(?:생길\s*수\s*있(?:어|어요|습니다)?|may\s+occur)?[.!?。？\s]*$/i.test(corrected.trim())) {
    return swellingPhrase;
  }

  return corrected
    .replace(/그종|구종|붓종/g, swellingTerm)
    .replace(/\b(?:geu|gu|geo)[\s-]?jong\b/gi, swellingTerm);
}

const targetMisrecognitionCorrections: Partial<Record<GlossaryTargetLanguage, Array<[RegExp, string]>>> = {
  zh: [
    [/^(?:你不困吗|不困吗|困吗|你困吗)[?？。.\s]*$/i, "疼吗？"]
  ],
  zh_tw: [
    [/^(?:你不睏嗎|不睏嗎|睏嗎|你睏嗎)[?？。.\s]*$/i, "會痛嗎？"]
  ],
  ja: [
    [/^(?:眠くないですか|眠いですか|眠くありませんか)[?？。.\s]*$/i, "痛くないですか？"]
  ],
  en: [
    [/^(?:are\s+you\s+not\s+sleepy|you\s+not\s+sleepy|aren't\s+you\s+sleepy)[?？。.\s]*$/i, "Does it hurt?"],
    [/^(?:how\s+(?:are\s+)?you\s+setup|how\s+is\s+your\s+setup|how\s+are\s+you\s+set\s+up)[?？。.\s]*$/i, "How is the pain?"]
  ],
  ru: [
    [/^(?:вы\s+не\s+сонн(?:ый|ая|ые)|вы\s+хотите\s+спать|не\s+хотите\s+спать)[?？。.\s]*$/i, "Больно?"]
  ],
  vi: [
    [/^(?:bạn\s+có\s+buồn\s+ngủ\s+không|bạn\s+không\s+buồn\s+ngủ\s+à|buồn\s+ngủ\s+không)[?？。.\s]*$/i, "Có đau không?"]
  ],
  id: [
    [/^(?:apakah\s+anda\s+mengantuk|anda\s+tidak\s+mengantuk|mengantuk)[?？。.\s]*$/i, "Apakah sakit?"]
  ],
  th: [
    [/^(?:ง่วงไหม|คุณง่วงไหม|ไม่ง่วงหรือ)[?？。.\s]*$/i, "เจ็บไหม?"]
  ],
  ms: [
    [/^(?:anda\s+mengantuk|mengantuk\s+tak|tidak\s+mengantuk)[?？。.\s]*$/i, "Sakit tak?"]
  ],
  mn: [
    [/^(?:нойр\s+хүрч\s+байна\s+уу|та\s+нойрмог\s+байна\s+уу)[?？。.\s]*$/i, "Өвдөж байна уу?"]
  ],
  fr: [
    [/^(?:vous\s+n'avez\s+pas\s+sommeil|avez-vous\s+sommeil|vous\s+avez\s+sommeil)[?？。.\s]*$/i, "Est-ce que cela fait mal ?"]
  ],
  es: [
    [/^(?:no\s+tiene\s+sueño|tiene\s+sueño|le\s+da\s+sueño)[?¿？。.\s]*$/i, "¿Le duele?"]
  ],
  de: [
    [/^(?:sind\s+sie\s+nicht\s+müde|sind\s+sie\s+müde|haben\s+sie\s+schlaf)[?？。.\s]*$/i, "Tut es weh?"]
  ],
  it: [
    [/^(?:non\s+ha\s+sonno|ha\s+sonno|le\s+viene\s+sonno)[?？。.\s]*$/i, "Fa male?"]
  ],
  pt: [
    [/^(?:não\s+está\s+com\s+sono|está\s+com\s+sono|tem\s+sono)[?？。.\s]*$/i, "Dói?"]
  ]
};

function applyTargetSpecificCorrections(text: string, targetLanguage: GlossaryTargetLanguage) {
  const highPriorityCorrected = applyHighPriorityClinicCorrections(text, targetLanguage);
  const corrections = targetMisrecognitionCorrections[targetLanguage];
  if (!corrections) return highPriorityCorrected;

  return corrections.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    highPriorityCorrected
  );
}

function cleanRepeatedPunctuation(text: string) {
  return text
    .replace(/\?{2,}/g, "?")
    .replace(/？{2,}/g, "？")
    .replace(/。{2,}/g, "。")
    .replace(/\s+([?.!,。？！])/g, "$1");
}

const commonClinicCountWords: Array<[string, string]> = [
  ["six hundred", "600"],
  ["five hundred fifty", "550"],
  ["five hundred", "500"],
  ["four hundred fifty", "450"],
  ["four hundred", "400"],
  ["three hundred fifty", "350"],
  ["three hundred", "300"],
  ["two hundred fifty", "250"],
  ["two hundred", "200"],
  ["one hundred fifty", "150"],
  ["one hundred", "100"],
  ["fifty", "50"],
  ["twenty", "20"],
  ["ten", "10"],
  ["six", "6"],
  ["five", "5"],
  ["four", "4"],
  ["three", "3"],
  ["two", "2"],
  ["one", "1"]
];

const chineseClinicCountWords: Array<[string, string]> = [
  ["六百", "600"],
  ["五百五十", "550"],
  ["五百", "500"],
  ["四百五十", "450"],
  ["四百", "400"],
  ["三百五十", "350"],
  ["三百", "300"],
  ["两百五十", "250"],
  ["兩百五十", "250"],
  ["二百五十", "250"],
  ["两百", "200"],
  ["兩百", "200"],
  ["二百", "200"],
  ["一百五十", "150"],
  ["一百", "100"],
  ["五十", "50"],
  ["二十", "20"],
  ["十", "10"],
  ["六", "6"],
  ["五", "5"],
  ["四", "4"],
  ["三", "3"],
  ["二", "2"],
  ["两", "2"],
  ["兩", "2"],
  ["一", "1"]
];

const japaneseClinicCountWords: Array<[string, string]> = [
  ["ろっぴゃく", "600"],
  ["ごひゃくごじゅう", "550"],
  ["ごひゃく", "500"],
  ["よんひゃくごじゅう", "450"],
  ["よんひゃく", "400"],
  ["さんびゃくごじゅう", "350"],
  ["さんびゃく", "300"],
  ["にひゃくごじゅう", "250"],
  ["にひゃく", "200"],
  ["ひゃくごじゅう", "150"],
  ["ひゃく", "100"],
  ["ごじゅう", "50"],
  ["にじゅう", "20"],
  ["じゅう", "10"],
  ["ろく", "6"],
  ["ご", "5"],
  ["よん", "4"],
  ["さん", "3"],
  ["に", "2"],
  ["いち", "1"],
  ["六百", "600"],
  ["五百五十", "550"],
  ["五百", "500"],
  ["四百五十", "450"],
  ["四百", "400"],
  ["三百五十", "350"],
  ["三百", "300"],
  ["二百五十", "250"],
  ["二百", "200"],
  ["一百五十", "150"],
  ["一百", "100"],
  ["五十", "50"]
];

function isChineseDisplayLanguage(targetLanguage: GlossaryTargetLanguage) {
  return targetLanguage === "zh" || targetLanguage === "zh_tw" || targetLanguage === "yue";
}

function isTraditionalChineseDisplay(targetLanguage: GlossaryTargetLanguage) {
  return targetLanguage === "zh_tw" || targetLanguage === "yue";
}

function applyChineseScriptDisplay(text: string, targetLanguage: GlossaryTargetLanguage) {
  if (!isChineseDisplayLanguage(targetLanguage)) return text;

  const replacements: Array<[RegExp, string]> = isTraditionalChineseDisplay(targetLanguage)
    ? [
        [/热玛吉/g, "熱瑪吉"],
        [/热马吉/g, "熱瑪吉"],
        [/热麻吉/g, "熱瑪吉"],
        [/热妈吉/g, "熱瑪吉"],
        [/韩元/g, "韓元"],
        [/价格/g, "價格"],
        [/单位/g, "單位"],
        [/发/g, "發"],
        [/万/g, "萬"]
      ]
    : [
        [/熱瑪吉/g, "热玛吉"],
        [/熱馬吉/g, "热玛吉"],
        [/熱麻吉/g, "热玛吉"],
        [/熱媽吉/g, "热玛吉"],
        [/韓元/g, "韩元"],
        [/價格/g, "价格"],
        [/單位/g, "单位"],
        [/發/g, "发"],
        [/萬/g, "万"]
      ];

  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

function normalizeChineseCountDisplay(text: string, targetLanguage: GlossaryTargetLanguage) {
  const shotCounter = isTraditionalChineseDisplay(targetLanguage) ? "發" : "发";
  const unitCounter = isTraditionalChineseDisplay(targetLanguage) ? "單位" : "单位";
  let normalized = text;

  for (const [word, value] of chineseClinicCountWords) {
    normalized = normalized.replace(
      new RegExp(`${escapeRegExp(word)}(?=\\s*(?:发|發|单位|單位|次|支|瓶|cc|ml|mL))`, "g"),
      value
    );
  }

  return normalized
    .replace(/(\d+)\s*(?:发|發)/g, `$1${shotCounter}`)
    .replace(/(\d+)\s*(?:单位|單位)/g, `$1${unitCounter}`)
    .replace(/(\d+)\s*(cc|ml|mL)\b/g, "$1$2");
}

function joinClinicProductAndCount(product: string, countWithCounter: string) {
  const cleanedProduct = product.trim().replace(/[。.,，\s]+$/g, "");
  return /[A-Za-z0-9)]$/.test(cleanedProduct) ? `${cleanedProduct} ${countWithCounter}` : `${cleanedProduct}${countWithCounter}`;
}

function normalizeChinesePricePhrasing(text: string, targetLanguage: GlossaryTargetLanguage) {
  const shotCounter = isTraditionalChineseDisplay(targetLanguage) ? "發" : "发";
  const priceWord = isTraditionalChineseDisplay(targetLanguage) ? "價格" : "价格";
  const tenThousandWord = isTraditionalChineseDisplay(targetLanguage) ? "萬" : "万";
  const krwWord = isTraditionalChineseDisplay(targetLanguage) ? "韓元" : "韩元";
  const pricePattern = "([\\d,.]+)\\s*(?:万|萬)\\s*(?:韩元|韓元)";
  const countPattern = "(\\d+)\\s*(?:发|發)";

  let normalized = text.replace(
    new RegExp(`^(您好)[。.,，\\s]*(.+?)\\s*${countPattern}\\s*(?:是|为|為)\\s*${pricePattern}[。.]?$`),
    (_match, greeting: string, product: string, count: string, price: string) =>
      `${greeting}，${joinClinicProductAndCount(product, `${count}${shotCounter}`)}的${priceWord}是${price}${tenThousandWord}${krwWord}。`
  );

  normalized = normalized.replace(
    new RegExp(`^(.+?)\\s*${countPattern}\\s*(?:是|为|為)\\s*${pricePattern}[。.]?$`),
    (_match, product: string, count: string, price: string) =>
      `${joinClinicProductAndCount(product, `${count}${shotCounter}`)}的${priceWord}是${price}${tenThousandWord}${krwWord}。`
  );

  return normalized;
}

function normalizeJapaneseCountDisplay(text: string) {
  let normalized = text;
  for (const [word, value] of japaneseClinicCountWords) {
    normalized = normalized.replace(new RegExp(`${escapeRegExp(word)}(?=\\s*(?:ショット|ユニット|cc|ml|mL))`, "g"), value);
  }

  return normalized.replace(/(\d+)\s*(ショット|ユニット|cc|ml|mL)\b/g, "$1$2");
}

function normalizeJapanesePricePhrasing(text: string) {
  const pricePattern = "([\\d,.]+)\\s*万\\s*ウォン";
  const countPattern = "(\\d+)\\s*ショット";

  let normalized = text.replace(
    new RegExp(`^(こんにちは)[。.\\s]*(.+?)\\s*${countPattern}\\s*(?:は|が|で)\\s*${pricePattern}\\s*です[。.]?$`),
    (_match, greeting: string, product: string, count: string, price: string) =>
      `${greeting}。${joinClinicProductAndCount(product, `${count}ショット`)}の料金は${price}万ウォンです。`
  );

  normalized = normalized.replace(
    new RegExp(`^(.+?)\\s*${countPattern}\\s*(?:は|が|で)\\s*${pricePattern}\\s*です[。.]?$`),
    (_match, product: string, count: string, price: string) =>
      `${joinClinicProductAndCount(product, `${count}ショット`)}の料金は${price}万ウォンです。`
  );

  return normalized;
}

function normalizeEnglishCountDisplay(text: string) {
  let normalized = text;
  for (const [word, value] of commonClinicCountWords) {
    normalized = normalized.replace(
      new RegExp(`\\b${escapeRegExp(word)}\\b(?=\\s+(?:shots?|units?|vials?|cc|ml|milliliters?))`, "gi"),
      value
    );
  }

  return normalized.replace(/(\d+)\s+(cc|ml)\b/gi, "$1$2");
}

function applyTextDisplayFormatting(text: string, targetLanguage: GlossaryTargetLanguage) {
  if (isChineseDisplayLanguage(targetLanguage)) {
    return normalizeChinesePricePhrasing(
      applyChineseScriptDisplay(normalizeChineseCountDisplay(text, targetLanguage), targetLanguage),
      targetLanguage
    );
  }

  if (targetLanguage === "ja") {
    return normalizeJapanesePricePhrasing(normalizeJapaneseCountDisplay(text));
  }

  if (targetLanguage === "en") {
    return normalizeEnglishCountDisplay(text);
  }

  return text;
}

function targetFor(entry: ClinicGlossaryEntry, targetLanguage: GlossaryTargetLanguage) {
  if (targetLanguage === "ko") return entry.standardKo;
  if (targetLanguage === "zh" || targetLanguage === "zh_tw" || targetLanguage === "yue") return entry.zh;
  if (targetLanguage === "ja") return entry.ja;
  if (targetLanguage === "en") return entry.en;
  if (targetLanguage === "ru") return entry.ru;
  if (targetLanguage === "vi") return entry.vi;
  if (targetLanguage === "id" || targetLanguage === "ms" || targetLanguage === "tl") return entry.id;
  return entry.en;
}

function targetForCritical(entry: CriticalShortPhrase, targetLanguage: GlossaryTargetLanguage) {
  if (targetLanguage === "yue") return entry.translations.yue ?? entry.translations.zh_tw;
  if (targetLanguage === "tl") return entry.translations.tl ?? entry.translations.en;
  return entry.translations[targetLanguage] ?? entry.translations.en;
}

function isAsciiWordChar(value: string | undefined) {
  return !!value && /[A-Za-z0-9_]/.test(value);
}

function applyReplacementsLongestFirst(text: string, replacements: Array<{ source: string; target: string }>) {
  const sorted = replacements
    .filter(({ source }) => source)
    .sort((a, b) => b.source.length - a.source.length);

  if (sorted.length === 0) return text;

  const lookup = new Map<string, string>();
  const patterns: string[] = [];
  for (const { source, target } of sorted) {
    const key = source.toLocaleLowerCase();
    if (lookup.has(key)) continue;
    lookup.set(key, target);
    patterns.push(escapeRegExp(source));
  }

  return text.replace(new RegExp(patterns.join("|"), "gi"), (match, offset: number, fullText: string) => {
    const startsWithAsciiWord = isAsciiWordChar(match[0]);
    const endsWithAsciiWord = isAsciiWordChar(match[match.length - 1]);
    if (
      (startsWithAsciiWord && isAsciiWordChar(fullText[offset - 1])) ||
      (endsWithAsciiWord && isAsciiWordChar(fullText[offset + match.length]))
    ) {
      return match;
    }

    return lookup.get(match.toLocaleLowerCase()) ?? match;
  });
}

function configuredGlossaryInstructionsMaxChars() {
  const rawValue =
    typeof process !== "undefined" && process.env ? process.env.GLOSSARY_INSTRUCTIONS_MAX_CHARS : undefined;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
}

function joinGlossaryInstructionLines(fixedLines: string[], termLines: string[]) {
  const maxChars = configuredGlossaryInstructionsMaxChars();
  const fixedText = fixedLines.join("\n");
  if (fixedText.length >= maxChars) return fixedText;

  const acceptedTermLines: string[] = [];
  for (const line of termLines) {
    const candidate = [...fixedLines, ...acceptedTermLines, line].join("\n");
    if (candidate.length > maxChars) break;
    acceptedTermLines.push(line);
  }

  return [...fixedLines, ...acceptedTermLines].join("\n");
}

export function normalizeClinicTranslation(text: string, targetLanguage: GlossaryTargetLanguage, glossaryData?: ClinicGlossaryData) {
  let normalized = text;
  const sourceCriticalPhrases = glossaryData?.criticalPhrases ?? criticalShortPhrases;
  const sourceClinicGlossary = glossaryData?.terms ?? clinicGlossary;
  const criticalReplacements: Array<{ source: string; target: string }> = [];

  for (const entry of sourceCriticalPhrases) {
    const target = targetForCritical(entry, targetLanguage);
    const sources = new Set([
      ...entry.spoken,
      ...Object.values(entry.translations).filter((value): value is string => typeof value === "string" && value.length > 0)
    ]);

    for (const source of sources) {
      criticalReplacements.push({ source, target });
    }
  }
  normalized = applyReplacementsLongestFirst(normalized, criticalReplacements);

  if (rawGlossaryTargetLanguages.has(targetLanguage)) {
    const glossaryReplacements: Array<{ source: string; target: string }> = [];
    for (const entry of sourceClinicGlossary) {
      const target = targetFor(entry, targetLanguage);
      const sources = new Set([
        ...entry.spoken,
        entry.standardKo,
        entry.zh,
        entry.ja,
        entry.en,
        entry.ru,
        entry.vi,
        entry.id
      ]);

      for (const source of sources) {
        glossaryReplacements.push({ source, target });
      }
    }
    normalized = applyReplacementsLongestFirst(normalized, glossaryReplacements);
  }

  return cleanRepeatedPunctuation(applyTextDisplayFormatting(applyTargetSpecificCorrections(normalized, targetLanguage), targetLanguage));
}

export function buildClinicGlossaryInstructions(patientLanguage: PatientLanguage, glossaryData?: ClinicGlossaryData) {
  const sourceCriticalPhrases = glossaryData?.criticalPhrases ?? criticalShortPhrases;
  const sourceClinicGlossary = glossaryData?.terms ?? clinicGlossary;
  const fixedLines = [
    "Clinic glossary rules:",
    "- Preserve approved brand and procedure display forms exactly, but translate grammar, counters, particles, and price phrasing naturally.",
    "- Rejuran color-box nicknames are input-recognition aliases only. Output the official product identifier: Black Box => Rejuran Healer, Red Box => Rejuran HB, White Box => Rejuran I, Blue Box => Rejuran S, Purple Box => Rejuran Elaskin.",
    "- Preserve logical connectors exactly: keep or/alternatives distinct from and/combined requirements. Never change Korean 나/거나 into and when it means or.",
    "- In text output, prefer Arabic numerals for shots, units, cc, vial counts, and prices.",
    "- Use the clinic-approved speak form for high-risk short procedure instructions and safety phrases.",
    "- Short Korean procedure phrases are often spoken quickly. In a procedure room, prefer the pain and safety meaning over casual meanings like sleepiness or device setup.",
    "- Critical short phrase mappings:",
    ...sourceCriticalPhrases.map((entry) => `  - ${entry.spoken.join(" / ")} => ${targetForCritical(entry, patientLanguage)} (${entry.note})`),
    "- For Traditional Chinese and Cantonese, use Traditional Chinese characters even when a glossary source term is shown in Simplified Chinese.",
    "- For Thai, Vietnamese, Indonesian, Malay, Filipino/Tagalog, Mongolian, French, Spanish, German, Italian, and Portuguese, translate general safety and aftercare phrases naturally, while preserving the approved English display form for device and product brand names such as Re2O, XERF, Thermage FLX, Ultherapy Prime, Juvelook, Restylane, Belotero, Sculptra, Skinvive, PRP, LDM, and HDA.",
    "- Do not expand brand names into generic explanations unless the staff explains them."
  ];
  const approvedMedicalTermLines = patientLanguage === "zh"
    ? [
        "- Approved Korean-to-Simplified-Chinese medical terms: 한약 => 中药 (never 韩药); 안내 => 说明 or 指示 according to context; 붉어짐/발적 => 发红.",
        "- Do not translate 붉어짐/발적 as 红肿 unless the Korean source explicitly includes 붓기 or 부종. Never leave Korean words such as 안내 in Chinese output."
      ]
    : patientLanguage === "en"
      ? [
          "- Approved Korean-to-English medical terms: 약침 => pharmacopuncture injection (not generic injection); 약재 => medicinal herbs or ingredients (not generic medications)."
        ]
      : [];
  approvedMedicalTermLines.push(
    "- Keep these three procedures distinct: 침 => acupuncture treatment; 약침 => pharmacopuncture injection; 주사 => injection. Never replace one with another."
  );
  const termLines = rawGlossaryTargetLanguages.has(patientLanguage)
    ? sourceClinicGlossary.map((entry) => `- ${entry.standardKo}: ${targetFor(entry, patientLanguage)}`)
    : [];

  return joinGlossaryInstructionLines([...fixedLines, ...approvedMedicalTermLines], termLines);
}

export function buildClinicInterpreterGlossaryInstructions(
  inputLanguage: GlossaryTargetLanguage,
  outputLanguage: GlossaryTargetLanguage,
  glossaryData?: ClinicGlossaryData
) {
  if (outputLanguage !== "ko") {
    return buildClinicGlossaryInstructions(outputLanguage, glossaryData);
  }

  const sourceClinicGlossary = glossaryData?.terms ?? clinicGlossary;
  const reverseTermLines = inputLanguage === "ko" || !rawGlossaryTargetLanguages.has(inputLanguage)
    ? []
    : sourceClinicGlossary.map((entry) => `- ${targetFor(entry, inputLanguage)} => ${entry.standardKo}`);
  const chineseConsentLines = inputLanguage === "zh" || inputLanguage === "zh_tw" || inputLanguage === "yue"
    ? [
        "- Approved Chinese/Cantonese-to-Korean medical term: 药针 / 藥針 => 약침 (never 약물 주사 or 일반 주사).",
        "- In Korean-medicine or acupuncture context, 针 / 針 / 鍼 / 针灸 / 針灸 / 针刺 / 針刺 / 停针 / 停針 => 침 또는 침 치료 (never 주사). 注射 alone => 주사. Keep 침, 약침, and 주사 distinct.",
        "- Preserve explicit consent refusal at full strength: 不同意 / 唔同意 => 동의하지 않습니다 (do not weaken it to merely 원하지 않습니다)."
      ]
    : [];

  return joinGlossaryInstructionLines([
    "Reverse clinic glossary rules for Korean output:",
    "- Translate foreign medical terms to the clinic-approved Korean term, not to a broader generic treatment or medication.",
    "- Preserve explicit consent, refusal, stopping, allergy, pregnancy, and emergency wording at the same strength.",
    ...chineseConsentLines
  ], reverseTermLines);
}

export function buildClinicTranscriptionPrompt(
  inputLanguage: GlossaryTargetLanguage,
  transcriptionHints = realtimeKoreanTranscriptionHints,
  transcriptionHintMappings?: ClinicTranscriptionHintMapping[],
  maxChars = defaultClinicTranscriptionPromptMaxChars
) {
  if (inputLanguage === "ko") {
    const mappings = transcriptionHintMappings ?? transcriptionMappingsFromTerms(clinicGlossary);
    return buildKoreanTranscriptionPromptDetails(transcriptionHints, mappings, maxChars).prompt;
  }

  if (inputLanguage === "zh" || inputLanguage === "zh_tw" || inputLanguage === "yue") {
    return [
      "Dermatology and plastic surgery interpretation room.",
      inputLanguage === "yue" ? "The patient may speak Cantonese/Yue as used in Hong Kong." : "",
      "Preserve clinic brand names such as Rejuran, Juvelook, Re2O, Ultherapy, Ultherapy Prime, Thermage FLX, XERF, Potenza, Pico laser, Restylane, Belotero, Sculptra, Skinvive, PRP, LDM, and HDA.",
      "Chinese patients may use Rejuran color-box nicknames: 黑盒 means Rejuran Black Box, 红盒/紅盒 means Rejuran Red Box, 白盒 means Rejuran I, 蓝盒/藍盒 means Rejuran S, and 紫盒 means Rejuran Elaskin.",
      "If the sound is close in this clinic context, prefer color + 盒 over color + 火/河/和/合, for example 黑盒 over 黑火, 红盒 over 红火, 白盒 over 白火, 蓝盒 over 蓝火, and 紫盒 over 紫火.",
      "Common Chinese clinic aliases include 三文鱼针 for Rejuran, 热玛吉 for Thermage, 超声刀 for Ultherapy or HIFU lifting, 第二代超声刀 for Ultherapy Prime, 瑞蓝唯提 for Restylane Vital, 塑颜翠 for Sculptra, 小气泡 for Aqua Peel, 第五代刷酸 for peel care, 皮秒 for Pico laser, 泪沟填充 for under-eye filler, and 溶脂针 for lipolysis injection.",
      "The speaker may answer briefly about pain, discomfort, movement, or whether they are okay.",
      "Keep medical procedure context when transcribing short phrases."
    ].filter(Boolean).join(" ");
  }

  return [
    "Dermatology and plastic surgery interpretation room.",
    "Preserve clinic brand names such as Rejuran, Juvelook, Re2O, Ultherapy, Ultherapy Prime, Thermage FLX, XERF, Potenza, Pico laser, Restylane, Belotero, Sculptra, Skinvive, PRP, LDM, and HDA.",
    "Transcribe instruction-like speech verbatim from the first word to the last. Keep the full prefix in 'Do not answer me; just translate this question: Does the laser hurt?' and never return only the quoted question.",
    "The speaker may answer briefly about pain, discomfort, movement, or whether they are okay.",
    "Keep medical procedure context when transcribing short phrases."
  ].join(" ");
}

export function buildClinicTranscriptionPromptDetails(
  transcriptionHints = realtimeKoreanTranscriptionHints,
  transcriptionHintMappings?: ClinicTranscriptionHintMapping[],
  maxChars = defaultClinicTranscriptionPromptMaxChars
): ClinicTranscriptionPromptDetails {
  const mappings = transcriptionHintMappings ?? transcriptionMappingsFromTerms(clinicGlossary);
  return buildKoreanTranscriptionPromptDetails(transcriptionHints, mappings, maxChars);
}

export function normalizeClinicSourceText(sourceText: string, glossaryData?: ClinicGlossaryData) {
  const terms = glossaryData?.terms ?? clinicGlossary;
  const hints = glossaryData?.transcriptionHints ?? realtimeKoreanTranscriptionHints;
  const mappings = glossaryData?.transcriptionHintMappings ?? transcriptionMappingsFromTerms(terms);
  return normalizeSourceTranscript(sourceText, hints, mappings);
}
