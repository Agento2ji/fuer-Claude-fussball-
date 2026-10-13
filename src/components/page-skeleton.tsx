/** Skelett-Ladezustand statt Spinner (Abschnitt 7). */
export function PageSkeleton({ blocks = 4 }: { blocks?: number }) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-16" aria-busy="true" aria-label="Wird geladen">
      <div className="h-14 animate-pulse rounded-xl bg-muted" />
      <div className="h-9 w-2/3 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      {Array.from({ length: blocks }, (_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/70" />
      ))}
    </main>
  );
}
