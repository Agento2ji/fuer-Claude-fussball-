import Link from "next/link";
import { listPlayers } from "@/lib/queries/player";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spieler" };

const POSITION_SHORT = { goalkeeper: "TW", defender: "AB", midfielder: "MF", forward: "ST" } as const;

export default async function PlayersPage() {
  const players = await listPlayers();
  const byTeam = new Map<string, typeof players>();
  for (const p of players) byTeam.set(p.teamName, [...(byTeam.get(p.teamName) ?? []), p]);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pt-4 pb-16">
      <h1 className="text-2xl font-semibold tracking-tight">Spieler</h1>
      {players.length === 0 && (
        <p className="text-muted-foreground">
          Noch keine Spielerdaten. Ohne API-Key gibt es nur Testdaten: <code>npm run ingest -- testdaten</code>
        </p>
      )}
      {[...byTeam].map(([team, list]) => (
        <section key={team} aria-labelledby={`team-${list[0]!.teamId}`}>
          <h2 id={`team-${list[0]!.teamId}`} className="mb-2 text-sm font-medium text-muted-foreground">
            {team}
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {list.map((p) => (
              <li key={p.id}>
                <Link href={`/spieler/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                  <span className="w-6 text-right font-mono text-sm text-muted-foreground">{p.shirtNumber}</span>
                  <span className="flex-1">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.position ? POSITION_SHORT[p.position] : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
