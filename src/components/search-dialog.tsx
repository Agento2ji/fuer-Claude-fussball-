"use client";

import { CalendarDays, Search, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface Results {
  players: { id: number; name: string; team: string | null }[];
  teams: { id: number; name: string }[];
  matches: { id: number; label: string; kickoffAt: string; competition: string }[];
}

const EMPTY: Results = { players: [], teams: [], matches: [] };
const dateFmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" });

/**
 * Suche über Spieler, Teams und Spiele (Abschnitt 7). Öffnet mit „/“ oder
 * Strg/⌘+K aus jedem Bildschirm; Pfeiltasten wählen, Enter öffnet, Esc schließt.
 */
export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/suche?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        // abgebrochen oder offline – letzte Ergebnisse bleiben stehen
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const hasResults = results.players.length + results.teams.length + results.matches.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label="Suche öffnen (Taste /)"
        aria-keyshortcuts="/ Control+K Meta+K"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Suche</span>
        <kbd className="hidden rounded border px-1 text-[10px] sm:inline">/</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Suche" description="Spieler, Teams und Spiele suchen">
        <Command shouldFilter={false} label="Suche">
          <CommandInput value={query} onValueChange={setQuery} placeholder="Spieler, Team oder Spiel …" />
          <CommandList>
            {query.trim().length < 2 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Mindestens zwei Zeichen eingeben.</p>
            ) : (
              <CommandEmpty>{loading ? "Suche läuft …" : "Nichts gefunden."}</CommandEmpty>
            )}
            {hasResults && results.players.length > 0 && (
              <CommandGroup heading="Spieler">
                {results.players.map((p) => (
                  <CommandItem key={`p${p.id}`} value={`p${p.id}`} onSelect={() => go(`/spieler/${p.id}`)}>
                    <User aria-hidden />
                    <span>{p.name}</span>
                    {p.team && <span className="ml-auto truncate text-xs text-muted-foreground">{p.team}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {hasResults && results.teams.length > 0 && (
              <CommandGroup heading="Teams">
                {results.teams.map((t) => (
                  <CommandItem key={`t${t.id}`} value={`t${t.id}`} onSelect={() => go(`/teams/${t.id}`)}>
                    <Shield aria-hidden />
                    <span>{t.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {hasResults && results.matches.length > 0 && (
              <CommandGroup heading="Spiele">
                {results.matches.map((m) => (
                  <CommandItem key={`m${m.id}`} value={`m${m.id}`} onSelect={() => go(`/spiele/${m.id}`)}>
                    <CalendarDays aria-hidden />
                    <span className="truncate">{m.label}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{dateFmt.format(new Date(m.kickoffAt))}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
