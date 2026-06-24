package com.clinicvoiceroom.staff

import java.text.Normalizer
import java.util.Locale

data class InstantTemplateMatch(
    val templateId: String,
    val sourceText: String,
    val translatedText: String
)

private data class InstantTranslationTemplate(
    val id: String,
    val category: String,
    val ko: String,
    val allowedContexts: Set<String>,
    val aliases: Set<String> = emptySet(),
    val blockedTerms: Set<String> = emptySet(),
    val translations: Map<String, String>,
    val enabled: Boolean = true
)

private val androidLocalInstantTemplateContexts = setOf(
    "reception",
    "waiting",
    "movement",
    "consultation",
    "photo",
    "procedure_prep",
    "procedure_room",
    "recovery",
    "app"
)

private val instantTemplateLanguages = setOf(
    "zh",
    "yue",
    "zh_tw",
    "ja",
    "en",
    "th",
    "ms",
    "mn",
    "ru",
    "vi",
    "id",
    "tl",
    "fr",
    "es",
    "de",
    "it",
    "pt"
)

private val globalInstantTemplateBlockedTerms = listOf(
    "서명",
    "동의",
    "동의서",
    "부작용",
    "정상",
    "이상",
    "괜찮",
    "안전",
    "효과",
    "보장",
    "확정",
    "금액",
    "가격",
    "환불",
    "복용",
    "하루",
    "몇 번",
    "용량",
    "금식",
    "금수",
    "마취",
    "임신",
    "알레르기",
    "시술 후",
    "퇴원 후",
    "운전",
    "음주",
    "흡연"
)

private val globalInstantTemplateBlockedPatterns = listOf(
    Regex("\\d"),
    Regex("[일이삼사오육칠팔구십한두세네다섯여섯일곱여덟아홉]\\s*(분|시간|번|회|원|만원|cc|씨씨|mg|ml)")
)

private val instantTranslationTemplates = listOf(
    InstantTranslationTemplate(
        id = "SAFE_004",
        category = "접수/대기 안내",
        ko = "여기에서 잠시 기다려 주세요.",
        allowedContexts = setOf("reception", "waiting"),
        aliases = setOf("여기서 잠시 기다려 주세요.", "잠시 기다려 주세요."),
        translations = mapOf(
            "zh" to "请在这里稍等。",
            "yue" to "請喺呢度等一陣。",
            "zh_tw" to "請在這裡稍等。",
            "ja" to "こちらで少々お待ちください。",
            "en" to "Please wait here for a moment.",
            "th" to "กรุณารอสักครู่ตรงนี้",
            "ms" to "Sila tunggu sebentar di sini.",
            "mn" to "Энд түр хүлээнэ үү.",
            "ru" to "Пожалуйста, подождите здесь немного.",
            "vi" to "Vui lòng chờ một chút ở đây.",
            "id" to "Mohon tunggu sebentar di sini.",
            "tl" to "Pakihintay muna rito.",
            "fr" to "Veuillez patienter ici un moment.",
            "es" to "Por favor, espere aquí un momento.",
            "de" to "Bitte warten Sie einen Moment hier.",
            "it" to "Per favore, aspetti qui un momento.",
            "pt" to "Por favor, aguarde aqui um momento."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_007",
        category = "이동 안내",
        ko = "이쪽으로 오세요.",
        allowedContexts = setOf("movement"),
        aliases = setOf("이쪽으로 와 주세요.", "이쪽으로 오시면 됩니다."),
        translations = mapOf(
            "zh" to "请到这边来。",
            "yue" to "請過嚟呢邊。",
            "zh_tw" to "請到這邊來。",
            "ja" to "こちらへどうぞ。",
            "en" to "Please come this way.",
            "th" to "เชิญทางนี้",
            "ms" to "Sila ikut sini.",
            "mn" to "Наашаа ирнэ үү.",
            "ru" to "Пожалуйста, пройдите сюда.",
            "vi" to "Mời đi lối này.",
            "id" to "Silakan ke sini.",
            "tl" to "Dito po kayo.",
            "fr" to "Veuillez venir par ici.",
            "es" to "Por favor, venga por aquí.",
            "de" to "Bitte kommen Sie hierher.",
            "it" to "Per favore, venga da questa parte.",
            "pt" to "Por favor, venha por aqui."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_008",
        category = "이동 안내",
        ko = "안으로 들어오세요.",
        allowedContexts = setOf("movement", "consultation", "photo"),
        aliases = setOf("안으로 들어와 주세요.", "들어오세요."),
        translations = mapOf(
            "zh" to "请进来。",
            "yue" to "請入嚟。",
            "zh_tw" to "請進來。",
            "ja" to "どうぞお入りください。",
            "en" to "Please come in.",
            "th" to "กรุณาเข้ามาด้านใน",
            "ms" to "Sila masuk.",
            "mn" to "Дотогш орно уу.",
            "ru" to "Пожалуйста, входите.",
            "vi" to "Vui lòng vào bên trong.",
            "id" to "Silakan masuk.",
            "tl" to "Pumasok po kayo.",
            "fr" to "Veuillez entrer.",
            "es" to "Por favor, pase.",
            "de" to "Bitte kommen Sie herein.",
            "it" to "Per favore, entri.",
            "pt" to "Por favor, entre."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_010",
        category = "자세/방향 안내",
        ko = "의자에 앉아 주세요.",
        allowedContexts = setOf("consultation", "photo", "procedure_prep"),
        aliases = setOf("의자에 앉아주세요.", "의자에 앉으세요."),
        translations = mapOf(
            "zh" to "请坐到椅子上。",
            "yue" to "請坐喺張櫈度。",
            "zh_tw" to "請坐到椅子上。",
            "ja" to "椅子にお掛けください。",
            "en" to "Please sit on the chair.",
            "th" to "กรุณานั่งที่เก้าอี้",
            "ms" to "Sila duduk di kerusi.",
            "mn" to "Сандал дээр сууна уу.",
            "ru" to "Пожалуйста, сядьте на стул.",
            "vi" to "Vui lòng ngồi lên ghế.",
            "id" to "Silakan duduk di kursi.",
            "tl" to "Umupo po kayo sa silya.",
            "fr" to "Veuillez vous asseoir sur la chaise.",
            "es" to "Por favor, siéntese en la silla.",
            "de" to "Bitte setzen Sie sich auf den Stuhl.",
            "it" to "Per favore, si sieda sulla sedia.",
            "pt" to "Por favor, sente-se na cadeira."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_011",
        category = "자세/방향 안내",
        ko = "침대에 누워 주세요.",
        allowedContexts = setOf("procedure_prep", "procedure_room"),
        aliases = setOf("침대에 누워주세요.", "침대에 누우세요."),
        translations = mapOf(
            "zh" to "请躺到床上。",
            "yue" to "請瞓喺床上面。",
            "zh_tw" to "請躺到床上。",
            "ja" to "ベッドに横になってください。",
            "en" to "Please lie down on the bed.",
            "th" to "กรุณานอนบนเตียง",
            "ms" to "Sila baring di atas katil.",
            "mn" to "Орон дээр хэвтэнэ үү.",
            "ru" to "Пожалуйста, лягте на кушетку.",
            "vi" to "Vui lòng nằm lên giường.",
            "id" to "Silakan berbaring di tempat tidur.",
            "tl" to "Humiga po kayo sa kama.",
            "fr" to "Veuillez vous allonger sur le lit.",
            "es" to "Por favor, recuéstese en la camilla.",
            "de" to "Bitte legen Sie sich auf die Liege.",
            "it" to "Per favore, si sdrai sul lettino.",
            "pt" to "Por favor, deite-se na maca."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_013",
        category = "자세/방향 안내",
        ko = "정면을 봐 주세요.",
        allowedContexts = setOf("photo", "consultation", "procedure_room"),
        aliases = setOf("정면 봐 주세요.", "앞을 봐 주세요."),
        translations = mapOf(
            "zh" to "请看前方。",
            "yue" to "請望前面。",
            "zh_tw" to "請看前方。",
            "ja" to "正面を見てください。",
            "en" to "Please look straight ahead.",
            "th" to "กรุณามองตรงไปข้างหน้า",
            "ms" to "Sila pandang ke hadapan.",
            "mn" to "Урагшаа харна уу.",
            "ru" to "Пожалуйста, смотрите прямо.",
            "vi" to "Vui lòng nhìn thẳng.",
            "id" to "Silakan lihat ke depan.",
            "tl" to "Tumingin po kayo sa harap.",
            "fr" to "Veuillez regarder devant vous.",
            "es" to "Por favor, mire al frente.",
            "de" to "Bitte schauen Sie nach vorn.",
            "it" to "Per favore, guardi davanti a sé.",
            "pt" to "Por favor, olhe para frente."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_014",
        category = "자세/방향 안내",
        ko = "고개를 오른쪽으로 돌려 주세요.",
        allowedContexts = setOf("photo", "procedure_room"),
        aliases = setOf("고개 오른쪽으로 돌려 주세요.", "오른쪽으로 고개 돌려 주세요."),
        translations = mapOf(
            "zh" to "请把头转向右边。",
            "yue" to "請將個頭轉去右邊。",
            "zh_tw" to "請把頭轉向右邊。",
            "ja" to "顔を右に向けてください。",
            "en" to "Please turn your head to the right.",
            "th" to "กรุณาหันศีรษะไปทางขวา",
            "ms" to "Sila pusingkan kepala ke kanan.",
            "mn" to "Толгойгоо баруун тийш эргүүлнэ үү.",
            "ru" to "Пожалуйста, поверните голову направо.",
            "vi" to "Vui lòng quay đầu sang phải.",
            "id" to "Silakan putar kepala ke kanan.",
            "tl" to "Ipihit po ang ulo sa kanan.",
            "fr" to "Veuillez tourner la tête à droite.",
            "es" to "Por favor, gire la cabeza a la derecha.",
            "de" to "Bitte drehen Sie den Kopf nach rechts.",
            "it" to "Per favore, giri la testa a destra.",
            "pt" to "Por favor, vire a cabeça para a direita."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_015",
        category = "자세/방향 안내",
        ko = "고개를 왼쪽으로 돌려 주세요.",
        allowedContexts = setOf("photo", "procedure_room"),
        aliases = setOf("고개 왼쪽으로 돌려 주세요.", "왼쪽으로 고개 돌려 주세요."),
        translations = mapOf(
            "zh" to "请把头转向左边。",
            "yue" to "請將個頭轉去左邊。",
            "zh_tw" to "請把頭轉向左邊。",
            "ja" to "顔を左に向けてください。",
            "en" to "Please turn your head to the left.",
            "th" to "กรุณาหันศีรษะไปทางซ้าย",
            "ms" to "Sila pusingkan kepala ke kiri.",
            "mn" to "Толгойгоо зүүн тийш эргүүлнэ үү.",
            "ru" to "Пожалуйста, поверните голову налево.",
            "vi" to "Vui lòng quay đầu sang trái.",
            "id" to "Silakan putar kepala ke kiri.",
            "tl" to "Ipihit po ang ulo sa kaliwa.",
            "fr" to "Veuillez tourner la tête à gauche.",
            "es" to "Por favor, gire la cabeza a la izquierda.",
            "de" to "Bitte drehen Sie den Kopf nach links.",
            "it" to "Per favore, giri la testa a sinistra.",
            "pt" to "Por favor, vire a cabeça para a esquerda."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_020",
        category = "자세/방향 안내",
        ko = "몸을 움직이지 말아 주세요.",
        allowedContexts = setOf("photo", "procedure_room"),
        aliases = setOf("움직이지 말아 주세요.", "가만히 있어 주세요."),
        translations = mapOf(
            "zh" to "请不要动身体。",
            "yue" to "請唔好郁個身。",
            "zh_tw" to "請不要移動身體。",
            "ja" to "体を動かさないでください。",
            "en" to "Please do not move your body.",
            "th" to "กรุณาอย่าขยับตัว",
            "ms" to "Sila jangan gerakkan badan.",
            "mn" to "Биеэ бүү хөдөлгөөрэй.",
            "ru" to "Пожалуйста, не двигайтесь.",
            "vi" to "Vui lòng đừng cử động.",
            "id" to "Mohon jangan menggerakkan tubuh.",
            "tl" to "Huwag po kayong gagalaw.",
            "fr" to "Veuillez ne pas bouger.",
            "es" to "Por favor, no se mueva.",
            "de" to "Bitte bewegen Sie sich nicht.",
            "it" to "Per favore, non si muova.",
            "pt" to "Por favor, não mexa o corpo."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_022",
        category = "자세/방향 안내",
        ko = "눈을 감아 주세요.",
        allowedContexts = setOf("photo", "procedure_room"),
        aliases = setOf("눈 감아 주세요.", "눈을 감으세요."),
        translations = mapOf(
            "zh" to "请闭上眼睛。",
            "yue" to "請合埋眼。",
            "zh_tw" to "請閉上眼睛。",
            "ja" to "目を閉じてください。",
            "en" to "Please close your eyes.",
            "th" to "กรุณาหลับตา",
            "ms" to "Sila pejamkan mata.",
            "mn" to "Нүдээ анина уу.",
            "ru" to "Пожалуйста, закройте глаза.",
            "vi" to "Vui lòng nhắm mắt.",
            "id" to "Silakan pejamkan mata.",
            "tl" to "Ipikit po ang mga mata.",
            "fr" to "Veuillez fermer les yeux.",
            "es" to "Por favor, cierre los ojos.",
            "de" to "Bitte schließen Sie die Augen.",
            "it" to "Per favore, chiuda gli occhi.",
            "pt" to "Por favor, feche os olhos."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_024",
        category = "검사/촬영 안내",
        ko = "입을 벌려 주세요.",
        allowedContexts = setOf("photo", "consultation"),
        aliases = setOf("입 벌려 주세요.", "입을 벌려주세요."),
        translations = mapOf(
            "zh" to "请张开嘴。",
            "yue" to "請張開口。",
            "zh_tw" to "請張開嘴巴。",
            "ja" to "口を開けてください。",
            "en" to "Please open your mouth.",
            "th" to "กรุณาอ้าปาก",
            "ms" to "Sila buka mulut.",
            "mn" to "Амаа ангайна уу.",
            "ru" to "Пожалуйста, откройте рот.",
            "vi" to "Vui lòng há miệng.",
            "id" to "Silakan buka mulut.",
            "tl" to "Ibuka po ang bibig.",
            "fr" to "Veuillez ouvrir la bouche.",
            "es" to "Por favor, abra la boca.",
            "de" to "Bitte öffnen Sie den Mund.",
            "it" to "Per favore, apra la bocca.",
            "pt" to "Por favor, abra a boca."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_026",
        category = "검사/촬영 안내",
        ko = "숨을 편하게 쉬세요.",
        allowedContexts = setOf("photo", "procedure_room", "recovery"),
        aliases = setOf("편하게 숨 쉬세요.", "숨 편하게 쉬세요."),
        translations = mapOf(
            "zh" to "请自然呼吸。",
            "yue" to "請自然呼吸。",
            "zh_tw" to "請自然呼吸。",
            "ja" to "楽に呼吸してください。",
            "en" to "Please breathe normally.",
            "th" to "กรุณาหายใจตามปกติ",
            "ms" to "Sila bernafas seperti biasa.",
            "mn" to "Энгийнээр амьсгалаарай.",
            "ru" to "Пожалуйста, дышите спокойно.",
            "vi" to "Vui lòng thở bình thường.",
            "id" to "Silakan bernapas seperti biasa.",
            "tl" to "Huminga po nang normal.",
            "fr" to "Veuillez respirer normalement.",
            "es" to "Por favor, respire con normalidad.",
            "de" to "Bitte atmen Sie normal weiter.",
            "it" to "Per favore, respiri normalmente.",
            "pt" to "Por favor, respire normalmente."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_028",
        category = "시술 전 준비",
        ko = "신발을 벗어 주세요.",
        allowedContexts = setOf("procedure_prep"),
        aliases = setOf("신발 벗어 주세요.", "신발을 벗어주세요."),
        translations = mapOf(
            "zh" to "请脱掉鞋子。",
            "yue" to "請除鞋。",
            "zh_tw" to "請脫掉鞋子。",
            "ja" to "靴を脱いでください。",
            "en" to "Please take off your shoes.",
            "th" to "กรุณาถอดรองเท้า",
            "ms" to "Sila buka kasut.",
            "mn" to "Гутлаа тайлна уу.",
            "ru" to "Пожалуйста, снимите обувь.",
            "vi" to "Vui lòng tháo giày.",
            "id" to "Silakan lepas sepatu.",
            "tl" to "Pakihubad ang sapatos.",
            "fr" to "Veuillez enlever vos chaussures.",
            "es" to "Por favor, quítese los zapatos.",
            "de" to "Bitte ziehen Sie die Schuhe aus.",
            "it" to "Per favore, si tolga le scarpe.",
            "pt" to "Por favor, tire os sapatos."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_030",
        category = "시술 전 준비",
        ko = "액세서리는 잠시 빼 주세요.",
        allowedContexts = setOf("photo", "procedure_prep"),
        aliases = setOf("액세서리 잠시 빼 주세요.", "악세서리는 잠시 빼 주세요."),
        translations = mapOf(
            "zh" to "请暂时取下饰品。",
            "yue" to "請暫時除低飾物。",
            "zh_tw" to "請暫時取下飾品。",
            "ja" to "アクセサリーを外してください。",
            "en" to "Please remove your accessories for a moment.",
            "th" to "กรุณาถอดเครื่องประดับชั่วคราว",
            "ms" to "Sila tanggalkan aksesori sebentar.",
            "mn" to "Чимэглэлээ түр авна уу.",
            "ru" to "Пожалуйста, снимите украшения на время.",
            "vi" to "Vui lòng tháo phụ kiện tạm thời.",
            "id" to "Silakan lepas aksesori untuk sementara.",
            "tl" to "Pakitanggal muna ang mga alahas.",
            "fr" to "Veuillez enlever vos accessoires pour le moment.",
            "es" to "Por favor, quítese los accesorios por un momento.",
            "de" to "Bitte legen Sie den Schmuck kurz ab.",
            "it" to "Per favore, tolga gli accessori per un momento.",
            "pt" to "Por favor, retire os acessórios por um momento."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_033",
        category = "시술 전 준비",
        ko = "손을 소독해 주세요.",
        allowedContexts = setOf("reception", "procedure_prep"),
        aliases = setOf("손 소독해 주세요.", "손을 소독해주세요."),
        translations = mapOf(
            "zh" to "请消毒双手。",
            "yue" to "請消毒雙手。",
            "zh_tw" to "請消毒雙手。",
            "ja" to "手を消毒してください。",
            "en" to "Please sanitize your hands.",
            "th" to "กรุณาฆ่าเชื้อมือ",
            "ms" to "Sila nyahkuman tangan anda.",
            "mn" to "Гараа ариутгана уу.",
            "ru" to "Пожалуйста, обработайте руки антисептиком.",
            "vi" to "Vui lòng sát khuẩn tay.",
            "id" to "Mohon sanitasi tangan Anda.",
            "tl" to "Paki-disinfect ang mga kamay.",
            "fr" to "Veuillez désinfecter vos mains.",
            "es" to "Por favor, desinféctese las manos.",
            "de" to "Bitte desinfizieren Sie Ihre Hände.",
            "it" to "Per favore, disinfetti le mani.",
            "pt" to "Por favor, higienize as mãos."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_034",
        category = "시술 전 준비",
        ko = "마스크는 잠시 내려 주세요.",
        allowedContexts = setOf("photo", "consultation", "procedure_prep"),
        aliases = setOf("마스크 잠시 내려 주세요.", "마스크를 잠깐 내려 주세요.", "마스크 조금 내려 주세요."),
        blockedTerms = setOf("계속", "벗고", "착용하지", "시술 후"),
        translations = mapOf(
            "zh" to "请暂时把口罩拉下来。",
            "yue" to "請暫時拉低口罩。",
            "zh_tw" to "請暫時把口罩拉下來。",
            "ja" to "マスクを少し下げてください。",
            "en" to "Please lower your mask for a moment.",
            "th" to "กรุณาลดหน้ากากลงชั่วคราว",
            "ms" to "Sila turunkan pelitup muka sebentar.",
            "mn" to "Маскаа түр доошлуулна уу.",
            "ru" to "Пожалуйста, ненадолго опустите маску.",
            "vi" to "Vui lòng kéo khẩu trang xuống một chút.",
            "id" to "Silakan turunkan masker sebentar.",
            "tl" to "Pakibaba muna ang mask.",
            "fr" to "Veuillez baisser votre masque un moment.",
            "es" to "Por favor, baje la mascarilla un momento.",
            "de" to "Bitte ziehen Sie die Maske kurz herunter.",
            "it" to "Per favore, abbassi la mascherina per un momento.",
            "pt" to "Por favor, abaixe a máscara por um momento."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_036",
        category = "시술 중 안내",
        ko = "잠시 그대로 계세요.",
        allowedContexts = setOf("photo", "procedure_room"),
        aliases = setOf("그대로 계세요.", "잠시 가만히 계세요."),
        translations = mapOf(
            "zh" to "请先保持这个姿势。",
            "yue" to "請暫時保持呢個姿勢。",
            "zh_tw" to "請先保持這個姿勢。",
            "ja" to "そのままでいてください。",
            "en" to "Please stay like this for a moment.",
            "th" to "กรุณาอยู่ท่านี้สักครู่",
            "ms" to "Sila kekal begitu sebentar.",
            "mn" to "Иймээрээ түр байгаарай.",
            "ru" to "Пожалуйста, оставайтесь в таком положении.",
            "vi" to "Vui lòng giữ nguyên như vậy một lúc.",
            "id" to "Silakan tetap seperti itu sebentar.",
            "tl" to "Manatili po muna sa ganyang posisyon.",
            "fr" to "Veuillez rester comme ça un moment.",
            "es" to "Por favor, quédese así un momento.",
            "de" to "Bitte bleiben Sie kurz so.",
            "it" to "Per favore, resti così per un momento.",
            "pt" to "Por favor, fique assim por um momento."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_038",
        category = "통증/불편 확인",
        ko = "불편하시면 바로 말씀해 주세요.",
        allowedContexts = setOf("procedure_room", "recovery"),
        aliases = setOf("불편하면 바로 말씀해 주세요.", "불편하시면 말씀해 주세요."),
        translations = mapOf(
            "zh" to "如果不舒服，请马上告诉我们。",
            "yue" to "如果唔舒服，請即刻話我哋知。",
            "zh_tw" to "如果不舒服，請馬上告訴我們。",
            "ja" to "つらければすぐに教えてください。",
            "en" to "If you feel uncomfortable, please tell us right away.",
            "th" to "ถ้ารู้สึกไม่สบาย กรุณาแจ้งทันที",
            "ms" to "Jika tidak selesa, sila beritahu kami segera.",
            "mn" to "Тавгүй байвал шууд хэлээрэй.",
            "ru" to "Если вам некомфортно, сразу скажите нам.",
            "vi" to "Nếu thấy khó chịu, vui lòng báo ngay cho chúng tôi.",
            "id" to "Jika tidak nyaman, mohon beri tahu kami segera.",
            "tl" to "Kung hindi komportable, sabihin po agad sa amin.",
            "fr" to "Si vous vous sentez mal à l’aise, dites-le-nous tout de suite.",
            "es" to "Si se siente incómodo, díganoslo de inmediato.",
            "de" to "Wenn es unangenehm ist, sagen Sie uns bitte sofort Bescheid.",
            "it" to "Se prova fastidio, ce lo dica subito.",
            "pt" to "Se sentir desconforto, avise-nos imediatamente."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_045",
        category = "앱/통역 안내",
        ko = "이 앱으로 통역해드릴게요.",
        allowedContexts = setOf("app"),
        aliases = setOf("이 앱으로 통역해 드릴게요.", "앱으로 통역해드릴게요."),
        translations = mapOf(
            "zh" to "我们会用这个应用为您翻译。",
            "yue" to "我哋會用呢個App同您翻譯。",
            "zh_tw" to "我們會用這個App為您翻譯。",
            "ja" to "このアプリで通訳します。",
            "en" to "We will interpret using this app.",
            "th" to "เราจะใช้แอปนี้ช่วยแปลให้คุณ",
            "ms" to "Kami akan gunakan aplikasi ini untuk mentafsir.",
            "mn" to "Бид энэ апп-аар орчуулж өгнө.",
            "ru" to "Мы будем переводить с помощью этого приложения.",
            "vi" to "Chúng tôi sẽ phiên dịch bằng ứng dụng này.",
            "id" to "Kami akan menerjemahkan dengan aplikasi ini.",
            "tl" to "Gagamit kami ng app na ito para magsalin.",
            "fr" to "Nous allons traduire avec cette application.",
            "es" to "Vamos a interpretar con esta aplicación.",
            "de" to "Wir dolmetschen mit dieser App.",
            "it" to "Useremo questa app per interpretare.",
            "pt" to "Vamos usar este aplicativo para interpretar."
        )
    ),
    InstantTranslationTemplate(
        id = "SAFE_048",
        category = "앱/통역 안내",
        ko = "천천히 말씀해 주세요.",
        allowedContexts = setOf("app"),
        aliases = setOf("천천히 말해 주세요.", "조금 천천히 말씀해 주세요."),
        translations = mapOf(
            "zh" to "请说慢一点。",
            "yue" to "請講慢啲。",
            "zh_tw" to "請說慢一點。",
            "ja" to "ゆっくり話してください。",
            "en" to "Please speak slowly.",
            "th" to "กรุณาพูดช้า ๆ",
            "ms" to "Sila bercakap perlahan.",
            "mn" to "Удаан ярьна уу.",
            "ru" to "Пожалуйста, говорите медленнее.",
            "vi" to "Vui lòng nói chậm.",
            "id" to "Silakan berbicara perlahan.",
            "tl" to "Magsalita po nang dahan-dahan.",
            "fr" to "Veuillez parler lentement.",
            "es" to "Por favor, hable despacio.",
            "de" to "Bitte sprechen Sie langsam.",
            "it" to "Per favore, parli lentamente.",
            "pt" to "Por favor, fale devagar."
        )
    )
)

fun findAndroidLocalInstantTemplateMatch(
    sourceText: String,
    patientLanguage: String,
    activeContexts: Set<String> = androidLocalInstantTemplateContexts
): InstantTemplateMatch? {
    val trimmed = sourceText.trim()
    if (trimmed.isBlank() || patientLanguage !in instantTemplateLanguages) return null
    if (containsBlockedInstantTemplateContent(trimmed)) return null

    val normalizedSource = normalizeInstantTemplateText(trimmed)
    if (normalizedSource.isBlank()) return null

    for (template in instantTranslationTemplates) {
        if (!template.enabled) continue
        if (template.allowedContexts.intersect(activeContexts).isEmpty()) continue
        if (template.blockedTerms.any { trimmed.contains(it, ignoreCase = true) }) continue

        val matchKeys = (setOf(template.ko) + template.aliases).map(::normalizeInstantTemplateText).toSet()
        if (normalizedSource in matchKeys) {
            val translated = template.translations[patientLanguage] ?: return null
            return InstantTemplateMatch(
                templateId = template.id,
                sourceText = template.ko,
                translatedText = translated
            )
        }
    }

    return null
}

private fun containsBlockedInstantTemplateContent(text: String): Boolean {
    if (globalInstantTemplateBlockedTerms.any { text.contains(it, ignoreCase = true) }) return true
    return globalInstantTemplateBlockedPatterns.any { it.containsMatchIn(text) }
}

private fun normalizeInstantTemplateText(text: String): String {
    return Normalizer.normalize(text.trim(), Normalizer.Form.NFKC)
        .lowercase(Locale.KOREAN)
        .replace(Regex("[\\s\\p{Punct}。！？…“”‘’「」『』]+"), "")
}
