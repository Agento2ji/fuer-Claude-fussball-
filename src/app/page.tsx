import { COMPETITIONS } from "@/config/competitions";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Fußball-Hub</h1>
      <p className="mt-2 text-muted">
        Spielerstatus, Statistik, Formbewertung und Quotenvergleich.
      </p>

      <section className="mt-8" aria-labelledby="wettbewerbe">
        <h2 id="wettbewerbe" className="text-sm font-medium uppercase text-muted">
          Wettbewerbe in Version 1
        </h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
          {COMPETITIONS.map((c) => (
            <li key={c.code} className="flex items-center justify-between px-4 py-3">
              <span>{c.name}</span>
              <span className="font-mono text-xs text-muted">{c.code}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Spiel- und Spielerdaten werden ab Meilenstein 2 eingelesen.
        </p>
      </section>
    </main>
  );
}
