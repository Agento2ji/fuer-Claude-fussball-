# Fußball-Hub

Spielerstatus, Statistik, Formbewertung, Quotenvergleich und Übertragungsinfos
für Premier League, Bundesliga, Serie A, LaLiga, Ligue 1, Champions League und
Europa League (jeweils laufende Saison). Lernprojekt, läuft nur lokal.

## Schnellstart

Voraussetzungen: Node.js 22, Docker.

```bash
cp .env.example .env.local   # Keys eintragen, soweit vorhanden
npm install
npm run lokal                # Postgres starten, migrieren, seeden, Dev-Server
```

Danach läuft die App unter http://localhost:3000.

Ohne Docker: eine eigene Postgres-Datenbank anlegen, `DATABASE_URL` in
`.env.local` setzen und `npm run db:migrate && npm run db:seed && npm run dev`.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run lokal` | Alles in einem: Datenbank, Migration, Seed, Dev-Server |
| `npm run db:generate` | Migration aus `src/db/schema.ts` erzeugen |
| `npm run db:migrate` | Migrationen einspielen |
| `npm run db:seed` | Quellen, Wettbewerbe, Buchmacher aus `src/config` übertragen |
| `npm run ingest -- spiele [CODE …]` | Spielpläne und Ergebnisse abrufen (Standard: alle Wettbewerbe) |
| `npm run ingest -- quoten [CODE …]` | Quoten abrufen (braucht `THE_ODDS_API_KEY`, sonst übersprungen) |
| `npm run ingest -- testdaten` | Erfundene „Testliga“ einspielen (siehe unten) |
| `npm run lint` / `typecheck` / `test` | Prüfungen wie in der CI |
| `npm run test:e2e` | E2E-Smoke-Tests (vorher `npm run build` und `npm run ingest -- testdaten`) |

## Seiten

| Pfad | Inhalt |
| --- | --- |
| `/` | Wettbewerbe mit Datenstand |
| `/wettbewerbe/[code]` | Tabelle (aus Ergebnissen berechnet) und nächste Spiele |
| `/teams/[id]` | Platz, Punkte, Form, nächstes Spiel, Ausfälle, Teamstatistik, Kader |
| `/spieler` und `/spieler/[id]` | Kaderliste und Spielerseite mit Status, Sperrgefahr, Statistik, Vertrag |

Jede angezeigte Zahl ist antippbar und zeigt Quelle und Abrufzeitpunkt.
Testdaten sind auf jeder Seite deutlich gekennzeichnet.

## Aufbau

Drei Schichten, strikt getrennt: Ingestion holt und normalisiert, die
Datenbank hält den Wahrheitsstand, die App liest nur aus der Datenbank.

- `src/config/` – Wettbewerbe, Buchmacher, Datenquellen, Anbieter-Ketten als Konfiguration
- `src/ingestion/` – Daten-Layer: Provider-Schnittstellen (`types.ts`), Adapter
  (`providers/`), HTTP mit Cache, Rate-Limit, Backoff und Zod (`http.ts`),
  Fallback-Kette, Schreib-Schicht (`store/`) und Jobs (`jobs/`)
- `src/db/schema.ts` – Datenmodell (Drizzle), Migrationen in `drizzle/`
- `src/lib/env.ts` – Validierung der Umgebungsvariablen (Zod)
- `scripts/` – Migration und Seed
- `tests/unit/` – Unit-Tests, `tests/db/` – Tests gegen echte Datenbank

Ein Anbieterwechsel ist eine Zeile in `src/config/providers.ts`. Anbieter ohne
API-Key werden übersprungen, nicht durch erfundene Daten ersetzt. Jeder Job
protokolliert Dauer, Ergebnis und Fehler in `job_runs`; widersprüchliche
Quellen landen in `data_conflicts` (die höher priorisierte gewinnt).

Grundregeln im Datenmodell: jede Zeile mit Daten von außen trägt `source_id`,
`fetched_at` und `source_url`; Zeiten in UTC, Anzeige in Europe/Berlin;
externe IDs in `external_ids`; `odds_snapshots` ist per Trigger append-only.

## Datenanbieter

Vorgabe: zunächst 0 € Budget. Stand der Recherche: 13.10.2026.

| Anbieter | Wofür | Kosten | Limit (kostenlos) | Lizenz / Einschränkung | Status |
| --- | --- | --- | --- | --- | --- |
| [openfootball](https://github.com/openfootball/football.json) | Spielpläne, Endergebnisse (Top-5-Ligen) | 0 € | keins (GitHub Raw) | Gemeinfrei (CC0). Ohne Champions/Europa League. Ergebnisse hinken teils Wochen hinterher (Stand 13.10.: letztes Ergebnis vom 20.09.); Anstoßzeit oft nur als Datum | aktiv |
| [API-Football](https://www.api-football.com) | Spiele, Aufstellungen, Spielerstatistik, Verletzungen | 0 €; Bezahltarife laut Anbieter-Blog ab ca. 15–19 $/Monat (unbestätigt) | 100 Abrufe/Tag | Kostenlos nur „aktuelle Saisons“; Zugriff auf laufende Saison und Verletzungen noch mit eigenem Key prüfen | geplant |
| [football-data.org](https://www.football-data.org/pricing) | Spielpläne, Tabellen, Ergebnisse | 0 €; Aufstellungen/Karten ab 29 €/Monat | 10 Abrufe/Minute | Kostenlos: 12 Wettbewerbe ohne Europa League, Ergebnisse verzögert, keine Aufstellungen | geplant |
| [The Odds API](https://the-odds-api.com) | Quoten Tipico, Winamax, Pinnacle | 0 €; 59 $/Monat für 100.000 Credits | 500 Credits/Monat | 1 Credit je Markt und Region; reicht für ca. einen Abruf pro Tag über alle 7 Wettbewerbe | geplant |
| Understat | xG, xA | – | – | robots.txt sperrt alles | verworfen |
| FBref | xG, xA | – | – | robots.txt nicht abrufbar (403); Bedingungen zu prüfen | offen |
| Transfermarkt | Verträge, Marktwerte | – | – | Keine öffentliche API; robots.txt erlaubt Profilseiten, Nutzungsbedingungen noch zu prüfen | offen |
| bundesliga.com, dfb.de, kicker.de, sportschau.de, premierleague.com | Sperren, Verletzungen, Übertragung | – | – | robots.txt erlaubt die relevanten Pfade; Nutzungsbedingungen noch zu prüfen | offen |
| uefa.com, dfl.de | Champions/Europa League, Mitteilungen | – | – | robots.txt nicht abrufbar | offen |

Scraper werden erst gebaut, wenn die Nutzungsbedingungen geprüft sind.

### Buchmacher

Verglichen werden nur Tipico und Winamax. Pinnacle dient ausschließlich als
Referenz für die faire Quote und wird nie als beste Quote angezeigt oder
verlinkt, weil nach aktuellem Kenntnisstand keine deutsche Erlaubnis
vorliegt. Die GGL-Whitelist ist für alle drei noch zu prüfen
(`gglLicenseVerified` in `src/config/bookmakers.ts`).

## Testdaten

`npm run ingest -- testdaten` spielt eine erfundene „Testliga“ ein: 6 fiktive
Vereine, 108 fiktive Spieler, 30 Spiele mit Statistik, Verletzungen, Sperren,
Verträgen, Übertragungen und Quoten. Bewusst keine echten Namen – eine
erfundene Verletzung eines echten Spielers wäre eine Falschinformation.

Testdaten tragen die Quelle `testdaten`, der Wettbewerb ist mit
`is_test_data` markiert, und die UI kennzeichnet sie. Sie stehen in keiner
Fallback-Kette und landen nie automatisch im Produktivpfad.
