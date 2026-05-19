import { BackButton } from "./BackButton";

export function AppFrame({
  children,
  narrow = false,
  backHref,
  backLabel
}: {
  children: React.ReactNode;
  narrow?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="min-h-screen bg-mist px-4 py-5 text-ink sm:px-6 sm:py-8">
      <div className={narrow ? "mx-auto max-w-[440px]" : "mx-auto max-w-5xl"}>
        {backHref ? <BackButton href={backHref} label={backLabel} /> : null}
        {children}
      </div>
    </main>
  );
}
