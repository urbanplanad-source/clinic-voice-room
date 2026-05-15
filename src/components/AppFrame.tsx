export function AppFrame({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <main className="min-h-screen bg-mist px-4 py-5 text-ink sm:px-6 sm:py-8">
      <div className={narrow ? "mx-auto max-w-[440px]" : "mx-auto max-w-5xl"}>{children}</div>
    </main>
  );
}
