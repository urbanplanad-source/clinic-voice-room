import type { HospitalSpecialty } from "@prisma/client";

export type SpecialtyGlossaryEntry = {
  specialty: HospitalSpecialty;
  spoken: string[];
  standardKo: string;
  translations: Record<string, string>;
  category: string;
  note: string;
};

export const specialtyGlossaryEntries: SpecialtyGlossaryEntry[] = [
  {
    specialty: "dermatology",
    spoken: ["여드름", "여드름성 피부"],
    standardKo: "여드름",
    translations: { zh: "痤疮", zh_tw: "痤瘡", yue: "暗瘡", ja: "ニキビ", en: "acne" },
    category: "condition",
    note: "dermatology acne"
  },
  {
    specialty: "dermatology",
    spoken: ["기미", "기미 색소"],
    standardKo: "기미",
    translations: { zh: "黄褐斑", zh_tw: "黃褐斑", yue: "黃褐斑", ja: "肝斑", en: "melasma" },
    category: "condition",
    note: "dermatology pigmentation"
  },
  {
    specialty: "dermatology",
    spoken: ["잡티", "얼굴 잡티"],
    standardKo: "잡티",
    translations: { zh: "色斑", zh_tw: "色斑", yue: "色斑", ja: "シミ", en: "blemishes" },
    category: "condition",
    note: "dermatology pigmentation"
  },
  {
    specialty: "dermatology",
    spoken: ["주근깨"],
    standardKo: "주근깨",
    translations: { zh: "雀斑", zh_tw: "雀斑", yue: "雀斑", ja: "そばかす", en: "freckles" },
    category: "condition",
    note: "dermatology pigmentation"
  },
  {
    specialty: "dermatology",
    spoken: ["검버섯", "나이 반점"],
    standardKo: "검버섯",
    translations: { zh: "老年斑", zh_tw: "老人斑", yue: "老人斑", ja: "老人性色素斑", en: "age spots" },
    category: "condition",
    note: "dermatology pigmentation"
  },
  {
    specialty: "dermatology",
    spoken: ["모낭염"],
    standardKo: "모낭염",
    translations: { zh: "毛囊炎", zh_tw: "毛囊炎", yue: "毛囊炎", ja: "毛嚢炎", en: "folliculitis" },
    category: "condition",
    note: "dermatology inflammation"
  },
  {
    specialty: "dermatology",
    spoken: ["아토피", "아토피 피부염"],
    standardKo: "아토피 피부염",
    translations: { zh: "特应性皮炎", zh_tw: "異位性皮膚炎", yue: "異位性皮膚炎", ja: "アトピー性皮膚炎", en: "atopic dermatitis" },
    category: "condition",
    note: "dermatology dermatitis"
  },
  {
    specialty: "dermatology",
    spoken: ["접촉성 피부염"],
    standardKo: "접촉성 피부염",
    translations: { zh: "接触性皮炎", zh_tw: "接觸性皮膚炎", yue: "接觸性皮膚炎", ja: "接触皮膚炎", en: "contact dermatitis" },
    category: "condition",
    note: "dermatology dermatitis"
  },
  {
    specialty: "dermatology",
    spoken: ["습진"],
    standardKo: "습진",
    translations: { zh: "湿疹", zh_tw: "濕疹", yue: "濕疹", ja: "湿疹", en: "eczema" },
    category: "condition",
    note: "dermatology dermatitis"
  },
  {
    specialty: "dermatology",
    spoken: ["두드러기"],
    standardKo: "두드러기",
    translations: { zh: "荨麻疹", zh_tw: "蕁麻疹", yue: "風疹", ja: "じんましん", en: "hives" },
    category: "condition",
    note: "dermatology allergy"
  },
  {
    specialty: "dermatology",
    spoken: ["알레르기", "알러지"],
    standardKo: "알레르기",
    translations: { zh: "过敏", zh_tw: "過敏", yue: "敏感", ja: "アレルギー", en: "allergy" },
    category: "condition",
    note: "dermatology allergy"
  },
  {
    specialty: "dermatology",
    spoken: ["피부 장벽", "피부장벽"],
    standardKo: "피부 장벽",
    translations: { zh: "皮肤屏障", zh_tw: "皮膚屏障", yue: "皮膚屏障", ja: "皮膚バリア", en: "skin barrier" },
    category: "condition",
    note: "dermatology skin barrier"
  },
  {
    specialty: "dermatology",
    spoken: ["피지"],
    standardKo: "피지",
    translations: { zh: "皮脂", zh_tw: "皮脂", yue: "皮脂", ja: "皮脂", en: "sebum" },
    category: "condition",
    note: "dermatology sebum"
  },
  {
    specialty: "dermatology",
    spoken: ["블랙헤드", "블랙 헤드"],
    standardKo: "블랙헤드",
    translations: { zh: "黑头", zh_tw: "黑頭", yue: "黑頭", ja: "黒ずみ毛穴", en: "blackheads" },
    category: "condition",
    note: "dermatology pores"
  },
  {
    specialty: "dermatology",
    spoken: ["화이트헤드", "화이트 헤드"],
    standardKo: "화이트헤드",
    translations: { zh: "白头粉刺", zh_tw: "白頭粉刺", yue: "白頭粉刺", ja: "白ニキビ", en: "whiteheads" },
    category: "condition",
    note: "dermatology acne"
  },
  {
    specialty: "dermatology",
    spoken: ["압출", "여드름 압출"],
    standardKo: "압출",
    translations: { zh: "粉刺清理", zh_tw: "粉刺清理", yue: "粉刺清理", ja: "圧出処置", en: "extraction" },
    category: "procedure",
    note: "dermatology acne treatment"
  },
  {
    specialty: "dermatology",
    spoken: ["스케일링", "피부 스케일링"],
    standardKo: "스케일링",
    translations: { zh: "皮肤焕肤", zh_tw: "皮膚煥膚", yue: "皮膚煥膚", ja: "スキンスケーリング", en: "skin scaling" },
    category: "procedure",
    note: "dermatology exfoliation treatment"
  },
  {
    specialty: "dermatology",
    spoken: ["염증 주사", "염증주사"],
    standardKo: "염증 주사",
    translations: { zh: "消炎注射", zh_tw: "消炎注射", yue: "消炎針", ja: "炎症注射", en: "anti-inflammatory injection" },
    category: "procedure",
    note: "dermatology injection"
  },
  {
    specialty: "dermatology",
    spoken: ["점 제거", "점제거", "점 빼기"],
    standardKo: "점 제거",
    translations: { zh: "祛痣", zh_tw: "除痣", yue: "脫痣", ja: "ほくろ除去", en: "mole removal" },
    category: "procedure",
    note: "dermatology lesion removal"
  },
  {
    specialty: "dermatology",
    spoken: ["비립종"],
    standardKo: "비립종",
    translations: { zh: "粟丘疹", zh_tw: "粟丘疹", yue: "油脂粒", ja: "稗粒腫", en: "milia" },
    category: "condition",
    note: "dermatology lesion"
  },
  {
    specialty: "dermatology",
    spoken: ["한관종"],
    standardKo: "한관종",
    translations: { zh: "汗管瘤", zh_tw: "汗管瘤", yue: "汗管瘤", ja: "汗管腫", en: "syringoma" },
    category: "condition",
    note: "dermatology lesion"
  },
  {
    specialty: "dermatology",
    spoken: ["편평사마귀", "편평 사마귀"],
    standardKo: "편평사마귀",
    translations: { zh: "扁平疣", zh_tw: "扁平疣", yue: "扁平疣", ja: "扁平疣贅", en: "flat warts" },
    category: "condition",
    note: "dermatology wart"
  },
  {
    specialty: "dermatology",
    spoken: ["사마귀"],
    standardKo: "사마귀",
    translations: { zh: "疣", zh_tw: "疣", yue: "疣", ja: "いぼ", en: "warts" },
    category: "condition",
    note: "dermatology wart"
  },
  {
    specialty: "dermatology",
    spoken: ["티눈"],
    standardKo: "티눈",
    translations: { zh: "鸡眼", zh_tw: "雞眼", yue: "雞眼", ja: "魚の目", en: "corn" },
    category: "condition",
    note: "dermatology corn"
  },
  {
    specialty: "dermatology",
    spoken: ["항생제"],
    standardKo: "항생제",
    translations: { zh: "抗生素", zh_tw: "抗生素", yue: "抗生素", ja: "抗生物質", en: "antibiotics" },
    category: "medication",
    note: "dermatology medication"
  },
  {
    specialty: "dermatology",
    spoken: ["항히스타민제"],
    standardKo: "항히스타민제",
    translations: { zh: "抗组胺药", zh_tw: "抗組織胺藥", yue: "抗組織胺藥", ja: "抗ヒスタミン薬", en: "antihistamines" },
    category: "medication",
    note: "dermatology medication"
  },
  {
    specialty: "dermatology",
    spoken: ["스테로이드 연고"],
    standardKo: "스테로이드 연고",
    translations: { zh: "类固醇药膏", zh_tw: "類固醇藥膏", yue: "類固醇藥膏", ja: "ステロイド軟膏", en: "steroid ointment" },
    category: "medication",
    note: "dermatology medication"
  },
  {
    specialty: "dermatology",
    spoken: ["처방전"],
    standardKo: "처방전",
    translations: { zh: "处方", zh_tw: "處方箋", yue: "處方", ja: "処方箋", en: "prescription" },
    category: "medical_admin",
    note: "dermatology prescription"
  },
  {
    specialty: "dermatology",
    spoken: ["피부 조직 검사", "조직 검사"],
    standardKo: "피부 조직 검사",
    translations: { zh: "皮肤活检", zh_tw: "皮膚切片檢查", yue: "皮膚活檢", ja: "皮膚生検", en: "skin biopsy" },
    category: "procedure",
    note: "dermatology diagnostic procedure"
  },
  {
    specialty: "dermatology",
    spoken: ["냉동치료", "냉동 치료"],
    standardKo: "냉동치료",
    translations: { zh: "冷冻治疗", zh_tw: "冷凍治療", yue: "冷凍治療", ja: "凍結療法", en: "cryotherapy" },
    category: "procedure",
    note: "dermatology treatment"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["쌍꺼풀 수술", "쌍수", "쌍꺼풀"],
    standardKo: "쌍꺼풀 수술",
    translations: { zh: "双眼皮手术", zh_tw: "雙眼皮手術", yue: "雙眼皮手術", ja: "二重まぶた手術", en: "double eyelid surgery" },
    category: "procedure",
    note: "plastic surgery eye"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["매몰법", "비절개 쌍꺼풀"],
    standardKo: "매몰법",
    translations: { zh: "埋线法", zh_tw: "埋線法", yue: "埋線法", ja: "埋没法", en: "non-incisional double eyelid method" },
    category: "procedure",
    note: "plastic surgery eye"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["절개법", "절개 쌍꺼풀"],
    standardKo: "절개법",
    translations: { zh: "切开法", zh_tw: "切開法", yue: "切開法", ja: "切開法", en: "incisional double eyelid method" },
    category: "procedure",
    note: "plastic surgery eye"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["앞트임"],
    standardKo: "앞트임",
    translations: { zh: "开内眼角", zh_tw: "開內眼角", yue: "開內眼角", ja: "目頭切開", en: "medial epicanthoplasty" },
    category: "procedure",
    note: "plastic surgery eye"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["뒤트임"],
    standardKo: "뒤트임",
    translations: { zh: "开外眼角", zh_tw: "開外眼角", yue: "開外眼角", ja: "目尻切開", en: "lateral canthoplasty" },
    category: "procedure",
    note: "plastic surgery eye"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["밑트임"],
    standardKo: "밑트임",
    translations: { zh: "下眼睑开大", zh_tw: "下眼瞼開大", yue: "下眼瞼開大", ja: "下眼瞼拡大", en: "lower canthoplasty" },
    category: "procedure",
    note: "plastic surgery eye"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["눈매교정", "눈매 교정"],
    standardKo: "눈매교정",
    translations: { zh: "眼型矫正", zh_tw: "眼型矯正", yue: "眼形矯正", ja: "眼瞼下垂矯正", en: "ptosis correction" },
    category: "procedure",
    note: "plastic surgery eye"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["상안검", "상안검 수술"],
    standardKo: "상안검 수술",
    translations: { zh: "上眼睑手术", zh_tw: "上眼瞼手術", yue: "上眼瞼手術", ja: "上まぶた手術", en: "upper blepharoplasty" },
    category: "procedure",
    note: "plastic surgery eye"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["하안검", "하안검 수술"],
    standardKo: "하안검 수술",
    translations: { zh: "下眼睑手术", zh_tw: "下眼瞼手術", yue: "下眼瞼手術", ja: "下まぶた手術", en: "lower blepharoplasty" },
    category: "procedure",
    note: "plastic surgery eye"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["눈밑지방재배치", "눈 밑 지방 재배치"],
    standardKo: "눈밑지방재배치",
    translations: { zh: "眼袋脂肪重置", zh_tw: "眼袋脂肪重置", yue: "眼袋脂肪重置", ja: "目の下の脂肪再配置", en: "under-eye fat repositioning" },
    category: "procedure",
    note: "plastic surgery eye"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["코성형", "코 수술"],
    standardKo: "코성형",
    translations: { zh: "鼻整形", zh_tw: "隆鼻手術", yue: "隆鼻手術", ja: "鼻整形", en: "rhinoplasty" },
    category: "procedure",
    note: "plastic surgery nose"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["콧대", "코대"],
    standardKo: "콧대",
    translations: { zh: "鼻梁", zh_tw: "鼻樑", yue: "鼻樑", ja: "鼻筋", en: "nasal bridge" },
    category: "body_part",
    note: "plastic surgery nose"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["코끝"],
    standardKo: "코끝",
    translations: { zh: "鼻尖", zh_tw: "鼻尖", yue: "鼻尖", ja: "鼻先", en: "nasal tip" },
    category: "body_part",
    note: "plastic surgery nose"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["매부리코"],
    standardKo: "매부리코",
    translations: { zh: "驼峰鼻", zh_tw: "駝峰鼻", yue: "駝峰鼻", ja: "わし鼻", en: "hump nose" },
    category: "condition",
    note: "plastic surgery nose"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["복코"],
    standardKo: "복코",
    translations: { zh: "蒜头鼻", zh_tw: "蒜頭鼻", yue: "蒜頭鼻", ja: "だんご鼻", en: "bulbous nose" },
    category: "condition",
    note: "plastic surgery nose"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["휜코", "휘어진 코"],
    standardKo: "휜코",
    translations: { zh: "歪鼻", zh_tw: "歪鼻", yue: "歪鼻", ja: "曲がった鼻", en: "deviated nose" },
    category: "condition",
    note: "plastic surgery nose"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["콧볼축소", "콧볼 축소"],
    standardKo: "콧볼축소",
    translations: { zh: "鼻翼缩小", zh_tw: "鼻翼縮小", yue: "鼻翼縮小", ja: "小鼻縮小", en: "alar reduction" },
    category: "procedure",
    note: "plastic surgery nose"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["보형물"],
    standardKo: "보형물",
    translations: { zh: "假体", zh_tw: "假體", yue: "假體", ja: "プロテーゼ", en: "implant" },
    category: "material",
    note: "plastic surgery implant"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["실리콘", "실리콘 보형물"],
    standardKo: "실리콘 보형물",
    translations: { zh: "硅胶假体", zh_tw: "矽膠假體", yue: "矽膠假體", ja: "シリコンプロテーゼ", en: "silicone implant" },
    category: "material",
    note: "plastic surgery implant"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["자가연골", "자가 연골"],
    standardKo: "자가연골",
    translations: { zh: "自体软骨", zh_tw: "自體軟骨", yue: "自體軟骨", ja: "自家軟骨", en: "autologous cartilage" },
    category: "material",
    note: "plastic surgery cartilage"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["귀연골", "귀 연골"],
    standardKo: "귀연골",
    translations: { zh: "耳软骨", zh_tw: "耳軟骨", yue: "耳軟骨", ja: "耳介軟骨", en: "ear cartilage" },
    category: "material",
    note: "plastic surgery cartilage"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["비중격연골", "비중격 연골"],
    standardKo: "비중격연골",
    translations: { zh: "鼻中隔软骨", zh_tw: "鼻中隔軟骨", yue: "鼻中隔軟骨", ja: "鼻中隔軟骨", en: "septal cartilage" },
    category: "material",
    note: "plastic surgery cartilage"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["늑연골", "갈비연골"],
    standardKo: "늑연골",
    translations: { zh: "肋软骨", zh_tw: "肋軟骨", yue: "肋軟骨", ja: "肋軟骨", en: "rib cartilage" },
    category: "material",
    note: "plastic surgery cartilage"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["안면윤곽", "안면 윤곽"],
    standardKo: "안면윤곽",
    translations: { zh: "面部轮廓手术", zh_tw: "臉部輪廓手術", yue: "面部輪廓手術", ja: "輪郭整形", en: "facial contouring surgery" },
    category: "procedure",
    note: "plastic surgery contouring"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["광대축소", "광대 축소"],
    standardKo: "광대축소",
    translations: { zh: "颧骨缩小", zh_tw: "顴骨縮小", yue: "顴骨縮小", ja: "頬骨縮小", en: "cheekbone reduction" },
    category: "procedure",
    note: "plastic surgery contouring"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["사각턱", "사각턱 수술"],
    standardKo: "사각턱 수술",
    translations: { zh: "方下颌手术", zh_tw: "方下顎手術", yue: "方下顎手術", ja: "エラ削り手術", en: "square jaw reduction" },
    category: "procedure",
    note: "plastic surgery contouring"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["턱끝수술", "턱끝 수술"],
    standardKo: "턱끝수술",
    translations: { zh: "下巴尖手术", zh_tw: "下巴手術", yue: "下巴手術", ja: "あご先手術", en: "genioplasty" },
    category: "procedure",
    note: "plastic surgery contouring"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["지방이식", "자가지방이식"],
    standardKo: "지방이식",
    translations: { zh: "脂肪移植", zh_tw: "脂肪移植", yue: "脂肪移植", ja: "脂肪注入", en: "fat grafting" },
    category: "procedure",
    note: "plastic surgery fat grafting"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["얼굴지방흡입", "얼굴 지방흡입"],
    standardKo: "얼굴지방흡입",
    translations: { zh: "面部吸脂", zh_tw: "臉部抽脂", yue: "面部抽脂", ja: "顔の脂肪吸引", en: "facial liposuction" },
    category: "procedure",
    note: "plastic surgery liposuction"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["실리프팅", "실 리프팅"],
    standardKo: "실리프팅",
    translations: { zh: "埋线提升", zh_tw: "埋線拉提", yue: "埋線拉提", ja: "糸リフト", en: "thread lifting" },
    category: "procedure",
    note: "plastic surgery lifting"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["절개"],
    standardKo: "절개",
    translations: { zh: "切口", zh_tw: "切口", yue: "切口", ja: "切開", en: "incision" },
    category: "surgery_term",
    note: "plastic surgery surgical term"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["봉합"],
    standardKo: "봉합",
    translations: { zh: "缝合", zh_tw: "縫合", yue: "縫合", ja: "縫合", en: "suturing" },
    category: "surgery_term",
    note: "plastic surgery surgical term"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["실밥제거", "실밥 제거"],
    standardKo: "실밥제거",
    translations: { zh: "拆线", zh_tw: "拆線", yue: "拆線", ja: "抜糸", en: "stitch removal" },
    category: "aftercare",
    note: "plastic surgery aftercare"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["압박밴드", "압박 밴드"],
    standardKo: "압박밴드",
    translations: { zh: "加压绷带", zh_tw: "加壓繃帶", yue: "加壓繃帶", ja: "圧迫バンド", en: "compression band" },
    category: "aftercare",
    note: "plastic surgery aftercare"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["수술 전 검사", "수술전 검사"],
    standardKo: "수술 전 검사",
    translations: { zh: "术前检查", zh_tw: "術前檢查", yue: "術前檢查", ja: "術前検査", en: "preoperative tests" },
    category: "medical_admin",
    note: "plastic surgery pre-op"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["마취"],
    standardKo: "마취",
    translations: { zh: "麻醉", zh_tw: "麻醉", yue: "麻醉", ja: "麻酔", en: "anesthesia" },
    category: "anesthesia",
    note: "plastic surgery anesthesia"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["수면마취", "수면 마취"],
    standardKo: "수면마취",
    translations: { zh: "睡眠麻醉", zh_tw: "舒眠麻醉", yue: "舒眠麻醉", ja: "静脈麻酔", en: "sedation anesthesia" },
    category: "anesthesia",
    note: "plastic surgery anesthesia"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["국소마취", "국소 마취"],
    standardKo: "국소마취",
    translations: { zh: "局部麻醉", zh_tw: "局部麻醉", yue: "局部麻醉", ja: "局所麻酔", en: "local anesthesia" },
    category: "anesthesia",
    note: "plastic surgery anesthesia"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["전신마취", "전신 마취"],
    standardKo: "전신마취",
    translations: { zh: "全身麻醉", zh_tw: "全身麻醉", yue: "全身麻醉", ja: "全身麻酔", en: "general anesthesia" },
    category: "anesthesia",
    note: "plastic surgery anesthesia"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["회복기간", "회복 기간"],
    standardKo: "회복기간",
    translations: { zh: "恢复期", zh_tw: "恢復期", yue: "恢復期", ja: "回復期間", en: "recovery period" },
    category: "aftercare",
    note: "plastic surgery recovery"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["흉터"],
    standardKo: "흉터",
    translations: { zh: "疤痕", zh_tw: "疤痕", yue: "疤痕", ja: "傷跡", en: "scar" },
    category: "condition",
    note: "plastic surgery scar"
  },
  {
    specialty: "plastic_surgery",
    spoken: ["비대칭"],
    standardKo: "비대칭",
    translations: { zh: "不对称", zh_tw: "不對稱", yue: "不對稱", ja: "左右差", en: "asymmetry" },
    category: "condition",
    note: "plastic surgery asymmetry"
  }
];
