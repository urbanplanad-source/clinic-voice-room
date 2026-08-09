import { BackButton } from "./BackButton";

export function AppFrame({
  children,
  narrow = false,
  wide = false,
  roomViewport = false,
  backHref,
  backLabel
}: {
  children: React.ReactNode;
  narrow?: boolean;
  wide?: boolean;
  roomViewport?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  if (roomViewport) {
    return (
      <main className="h-dvh overflow-hidden bg-mist text-ink sm:px-4">
        <div className={`mx-auto h-full overflow-y-auto ${narrow ? "max-w-[640px]" : wide ? "max-w-[1440px]" : "max-w-5xl"}`}>
          {children}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mist px-4 py-5 text-ink sm:px-6 sm:py-8">
      <div className={narrow ? "mx-auto max-w-[560px] md:max-w-[640px]" : wide ? "mx-auto max-w-[1440px]" : "mx-auto max-w-5xl"}>
        {backHref ? <BackButton href={backHref} label={backLabel} /> : null}
        {children}
      </div>
    </main>
  );
}
