import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl space-y-3 px-4 pt-10 pb-16">
      <h1 className="text-2xl font-semibold">Nicht gefunden</h1>
      <p className="text-muted-foreground">Diese Seite gibt es nicht, oder die Daten dazu fehlen noch.</p>
      <Link href="/" className="text-primary underline-offset-4 hover:underline">Zur Startseite</Link>
    </main>
  );
}
