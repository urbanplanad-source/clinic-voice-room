const sections = [
  {
    title: "1. 처리하는 정보",
    body:
      "MediVoice는 병원 직원 계정 로그인, 병원 단위 사용량 확인, 통역방 생성과 환자 QR 입장을 위해 필요한 최소한의 계정 정보, 병원 정보, 방 상태, 언어 설정, 사용량 메타데이터를 처리합니다."
  },
  {
    title: "2. 음성 및 번역 데이터",
    body:
      "통역 기능을 제공하기 위해 직원 또는 환자의 음성이 서버와 OpenAI API로 전송될 수 있습니다. 원본 음성 파일은 서비스 운영 목적으로 영구 저장하지 않습니다. 다만 번역 품질과 안전성 확인을 위해 각 번역의 원문과 번역문을 제한된 기간 보관할 수 있으며, 상담방의 실시간 임시 메시지와는 별도로 관리됩니다."
  },
  {
    title: "3. 제3자 처리",
    body:
      "음성 인식, 번역, 실시간 통역 처리를 위해 OpenAI가 데이터 처리자로 사용될 수 있습니다. API 키 등 서버 비밀값은 브라우저나 Android 앱에 노출하지 않습니다."
  },
  {
    title: "4. 보안",
    body:
      "서비스 통신은 HTTPS를 사용하며, 환자는 별도 계정 없이 임시 QR 링크로만 통역방에 입장합니다. 환자 링크는 방 단위로 발급되며 MVP 범위에서는 원본 음성 저장과 전체 상담 녹취 저장을 하지 않습니다."
  },
  {
    title: "5. 보관 및 삭제",
    body:
      "직원 로그인 세션, 병원 사용량 메타데이터, 통역방 운영에 필요한 최소 데이터는 서비스 제공과 운영 확인을 위해 필요한 기간 동안 보관될 수 있습니다. 통역방 종료 시 실시간 상담 메시지는 삭제 또는 만료 처리되며, 품질·안전 검토용 번역 원문과 번역문은 운영 설정에 따른 제한된 기간(기본 30일) 후 삭제 대상이 됩니다."
  },
  {
    title: "6. 문의",
    body:
      "개인정보 처리, 병원 계정, 데이터 삭제 요청은 MediVoice 운영자에게 문의해 주세요. 정식 배포 전에는 운영 주체의 사업자 정보, 연락처, 개인정보 보호책임자 정보를 이 페이지에 확정 기재해야 합니다."
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] px-5 py-10 text-[#191f28]">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-bold text-[#0f766e]">MediVoice</p>
        <h1 className="mt-2 text-3xl font-bold">개인정보처리방침</h1>
        <p className="mt-3 text-sm font-semibold text-slate-500">시행일: 2026년 6월 6일</p>

        <div className="mt-8 space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold">{section.title}</h2>
              <p className="mt-3 leading-7 text-slate-700">{section.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-sm leading-6 text-slate-500">
          이 문서는 Google Play 심사와 병원 현장 테스트를 위한 초안입니다. 실제 상용 배포 전에는 운영 법인,
          연락처, 개인정보 보호책임자, 국외 이전 여부, 위탁 처리 세부 항목을 법무 검토 후 확정해야 합니다.
        </p>
      </div>
    </main>
  );
}
