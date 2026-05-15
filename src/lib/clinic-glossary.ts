import type { PatientLanguage } from "./languages";

type ClinicGlossaryTerm = {
  ko: string;
  en: string;
  ja: string;
  zh: string;
};

export const clinicGlossary: ClinicGlossaryTerm[] = [
  { ko: "보톡스", en: "Botox", ja: "ボトックス", zh: "肉毒素" },
  { ko: "필러", en: "dermal filler", ja: "ヒアルロン酸フィラー", zh: "玻尿酸填充" },
  { ko: "리쥬란", en: "Rejuran", ja: "リジュラン", zh: "丽珠兰" },
  { ko: "리쥬란 힐러", en: "Rejuran Healer", ja: "リジュランヒーラー", zh: "丽珠兰修复针" },
  { ko: "쥬베룩", en: "Juvelook", ja: "ジュベルック", zh: "Juvelook" },
  { ko: "스킨부스터", en: "skin booster", ja: "スキンブースター", zh: "水光类皮肤营养针" },
  { ko: "엑소좀", en: "exosome", ja: "エクソソーム", zh: "外泌体" },
  { ko: "윤곽주사", en: "facial contouring injection", ja: "輪郭注射", zh: "轮廓针" },
  { ko: "지방분해주사", en: "fat-dissolving injection", ja: "脂肪溶解注射", zh: "溶脂针" },
  { ko: "물광주사", en: "hydrating skin booster injection", ja: "水光注射", zh: "水光针" },
  { ko: "연어주사", en: "PDRN injection", ja: "PDRN注射", zh: "PDRN再生针" },
  { ko: "시크릿주사", en: "secret injection", ja: "シークレット注射", zh: "Secret注射" },

  { ko: "울쎄라", en: "Ultherapy", ja: "ウルセラ", zh: "Ultherapy超声提升" },
  { ko: "울쎄라피프라임", en: "Ultherapy Prime", ja: "ウルセラピー プライム", zh: "Ultherapy Prime超声提升" },
  { ko: "써마지", en: "Thermage", ja: "サーマクール", zh: "热玛吉" },
  { ko: "인모드", en: "InMode", ja: "インモード", zh: "InMode" },
  { ko: "슈링크", en: "Shurink / HIFU lifting", ja: "シュリンク / HIFUリフティング", zh: "Shurink / HIFU超声提升" },
  { ko: "리니어지", en: "LinearZ", ja: "リニアZ", zh: "LinearZ" },
  { ko: "올리지오", en: "Oligio", ja: "オリジオ", zh: "Oligio" },
  { ko: "튠페이스", en: "Tune Face", ja: "チューンフェイス", zh: "Tune Face" },
  { ko: "HIFU", en: "HIFU", ja: "HIFU", zh: "HIFU" },
  { ko: "RF", en: "radiofrequency", ja: "高周波", zh: "射频" },
  { ko: "고주파", en: "radiofrequency", ja: "高周波", zh: "射频" },
  { ko: "초음파 리프팅", en: "ultrasound lifting", ja: "超音波リフティング", zh: "超声提升" },

  { ko: "피코토닝", en: "Pico toning", ja: "ピコトーニング", zh: "皮秒嫩肤" },
  { ko: "피코레이저", en: "pico laser", ja: "ピコレーザー", zh: "皮秒激光" },
  { ko: "토닝", en: "laser toning", ja: "レーザートーニング", zh: "激光嫩肤" },
  { ko: "색소레이저", en: "pigment laser", ja: "色素レーザー", zh: "色素激光" },
  { ko: "프락셀", en: "Fraxel / fractional laser", ja: "フラクショナルレーザー", zh: "点阵激光" },
  { ko: "CO2 레이저", en: "CO2 laser", ja: "CO2レーザー", zh: "CO2激光" },
  { ko: "IPL", en: "IPL", ja: "IPL", zh: "IPL光子嫩肤" },
  { ko: "브이빔", en: "Vbeam", ja: "Vビーム", zh: "Vbeam染料激光" },
  { ko: "엑셀브이", en: "Excel V", ja: "エクセルV", zh: "Excel V" },
  { ko: "제네시스", en: "Laser Genesis", ja: "ジェネシスレーザー", zh: "Genesis激光" },

  { ko: "여드름", en: "acne", ja: "ニキビ", zh: "痤疮 / 青春痘" },
  { ko: "여드름 흉터", en: "acne scar", ja: "ニキビ跡", zh: "痘坑 / 痘印" },
  { ko: "모공", en: "pores", ja: "毛穴", zh: "毛孔" },
  { ko: "홍조", en: "redness / facial flushing", ja: "赤み / 顔のほてり", zh: "泛红 / 面部潮红" },
  { ko: "혈관", en: "blood vessels / vascular lesions", ja: "血管 / 血管病変", zh: "血管 / 血管性病变" },
  { ko: "색소침착", en: "pigmentation", ja: "色素沈着", zh: "色素沉着" },
  { ko: "기미", en: "melasma", ja: "肝斑", zh: "黄褐斑" },
  { ko: "잡티", en: "blemishes / dark spots", ja: "シミ / 色むら", zh: "色斑 / 暗斑" },
  { ko: "주근깨", en: "freckles", ja: "そばかす", zh: "雀斑" },
  { ko: "탄력 저하", en: "loss of elasticity", ja: "弾力低下", zh: "弹性下降" },
  { ko: "잔주름", en: "fine wrinkles", ja: "小じわ", zh: "细纹" },
  { ko: "팔자주름", en: "nasolabial folds", ja: "ほうれい線", zh: "法令纹" },
  { ko: "이중턱", en: "double chin", ja: "二重あご", zh: "双下巴" },
  { ko: "턱선", en: "jawline", ja: "フェイスライン", zh: "下颌线" },
  { ko: "비대칭", en: "asymmetry", ja: "左右差 / 非対称", zh: "不对称" },

  { ko: "눈밑지방재배치", en: "under-eye fat repositioning", ja: "目の下の脂肪再配置", zh: "眼下脂肪重置" },
  { ko: "쌍꺼풀", en: "double eyelid surgery", ja: "二重まぶた手術", zh: "双眼皮手术" },
  { ko: "트임", en: "eyelid corner surgery", ja: "目頭・目尻切開", zh: "开眼角手术" },
  { ko: "코필러", en: "nose filler", ja: "鼻フィラー", zh: "鼻部填充" },
  { ko: "턱끝필러", en: "chin filler", ja: "あごフィラー", zh: "下巴填充" },
  { ko: "입술필러", en: "lip filler", ja: "唇フィラー", zh: "唇部填充" },
  { ko: "애교필러", en: "under-eye filler", ja: "涙袋フィラー", zh: "卧蚕填充" },
  { ko: "실리프팅", en: "thread lifting", ja: "糸リフト", zh: "埋线提升" },
  { ko: "윤곽", en: "facial contouring", ja: "輪郭形成", zh: "面部轮廓塑形" },

  { ko: "붓기", en: "swelling", ja: "腫れ", zh: "肿胀" },
  { ko: "멍", en: "bruising", ja: "内出血 / あざ", zh: "淤青" },
  { ko: "통증", en: "pain", ja: "痛み", zh: "疼痛" },
  { ko: "홍반", en: "redness", ja: "紅斑 / 赤み", zh: "红斑 / 泛红" },
  { ko: "열감", en: "warmth / burning sensation", ja: "熱感 / ほてり", zh: "发热感 / 灼热感" },
  { ko: "딱지", en: "scab", ja: "かさぶた", zh: "结痂" },
  { ko: "건조함", en: "dryness", ja: "乾燥", zh: "干燥" },
  { ko: "가려움", en: "itching", ja: "かゆみ", zh: "瘙痒" },
  { ko: "색소침착", en: "post-inflammatory hyperpigmentation", ja: "炎症後色素沈着", zh: "炎症后色素沉着" },
  { ko: "감염", en: "infection", ja: "感染", zh: "感染" },
  { ko: "알레르기", en: "allergy", ja: "アレルギー", zh: "过敏" },
  { ko: "울퉁불퉁함", en: "lumpiness / unevenness", ja: "凹凸 / しこり感", zh: "凹凸不平 / 结节感" },

  { ko: "재생관리", en: "regenerative care / recovery treatment", ja: "再生ケア / 回復管理", zh: "修复护理 / 再生护理" },
  { ko: "진정관리", en: "soothing treatment", ja: "鎮静ケア", zh: "舒缓护理" },
  { ko: "냉찜질", en: "cold compress", ja: "冷却", zh: "冷敷" },
  { ko: "자외선 차단", en: "sun protection", ja: "紫外線対策", zh: "防晒" },
  { ko: "선크림", en: "sunscreen", ja: "日焼け止め", zh: "防晒霜" },
  { ko: "음주 금지", en: "avoid alcohol", ja: "飲酒を控える", zh: "避免饮酒" },
  { ko: "사우나 금지", en: "avoid sauna", ja: "サウナを控える", zh: "避免桑拿" },
  { ko: "운동 금지", en: "avoid strenuous exercise", ja: "激しい運動を控える", zh: "避免剧烈运动" },
  { ko: "화장 가능", en: "makeup is allowed", ja: "メイク可能", zh: "可以化妆" },
  { ko: "세안 가능", en: "washing your face is allowed", ja: "洗顔可能", zh: "可以洗脸" },
  { ko: "시술 당일", en: "on the day of the treatment", ja: "施術当日", zh: "治疗当天" },
  { ko: "회복기간", en: "recovery period", ja: "回復期間", zh: "恢复期" },
  { ko: "유지기간", en: "duration of effect", ja: "持続期間", zh: "维持时间" },
  { ko: "리터치", en: "touch-up", ja: "リタッチ", zh: "补做 / 修补" }
];

const glossaryLanguageKeys: Record<PatientLanguage, keyof ClinicGlossaryTerm> = {
  zh: "zh",
  ja: "ja",
  en: "en",
  ru: "en",
  vi: "en",
  id: "en"
};

export function buildClinicGlossaryInstructions(patientLanguage: PatientLanguage) {
  const targetKey = glossaryLanguageKeys[patientLanguage];
  return clinicGlossary.map((term) => `- ${term.ko}: ${term[targetKey]} (${term.en})`).join("\n");
}
