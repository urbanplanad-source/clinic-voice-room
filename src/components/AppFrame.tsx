import { BackButton } from "./BackButton";

export function AppFrame({
  children,
  narrow = false,
  wide = false,
  backHref,
  backLabel
}: {
  children: React.ReactNode;
  narrow?: boolean;
  wide?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="min-h-screen bg-mist px-4 py-5 text-ink sm:px-6 sm:py-8">
      <div className={narrow ? "mx-auto max-w-[560px] md:max-w-[640px]" : wide ? "mx-auto max-w-[1440px]" : "mx-auto max-w-5xl"}>
        {backHref ? <BackButton href={backHref} label={backLabel} /> : null}
        {children}
      </div>
    </main>
  );
}
