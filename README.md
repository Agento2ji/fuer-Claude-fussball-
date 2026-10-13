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
| `npm run lint` / `typecheck` / `test` | Prüfungen wie in der CI |

## Aufbau

Drei Schichten, strikt getrennt: Ingestion holt und normalisiert, die
Datenbank hält den Wahrheitsstand, die App liest nur aus der Datenbank.

- `src/config/` – Wettbewerbe, Buchmacher, Datenquellen als Konfiguration
- `src/db/schema.ts` – Datenmodell (Drizzle), Migrationen in `drizzle/`
- `src/lib/env.ts` – Validierung der Umgebungsvariablen (Zod)
- `scripts/` – Migration und Seed
- `tests/unit/` – Unit-Tests, `tests/db/` – Tests gegen echte Datenbank

Grundregeln im Datenmodell: jede Zeile mit Daten von außen trägt `source_id`,
`fetched_at` und `source_url`; Zeiten in UTC, Anzeige in Europe/Berlin;
externe IDs in `external_ids`; `odds_snapshots` ist per Trigger append-only.

## Datenanbieter

Vorgabe: zunächst 0 € Budget. Stand der Recherche: 13.10.2026.

| Anbieter | Wofür | Kosten | Limit (kostenlos) | Lizenz / Einschränkung | Status |
| --- | --- | --- | --- | --- | --- |
| [API-Football](https://www.api-football.com) | Spiele, Aufstellungen, Spielerstatistik, Verletzungen | 0 €; Bezahltarife laut Anbieter-Blog ab ca. 15–19 $/Monat (unbestätigt) | 100 Abrufe/Tag | Kostenlos nur „aktuelle Saisons“; Zugriff auf laufende Saison und Verletzungen noch mit eigenem Key prüfen | geplant |
| [football-data.org](https://www.football-data.org/pricing) | Spielpläne, Tabellen, Ergebnisse | 0 €; Aufstellungen/Karten ab 29 €/Monat | 10 Abrufe/Minute | Kostenlos: 12 Wettbewerbe ohne Europa League, Ergebnisse verzögert, keine Aufstellungen | geplant |
| [The Odds API](https://the-odds-api.com) | Quoten Tipico, Winamax, Pinnacle | 0 €; 59 $/Monat für 100.000 Credits | 500 Credits/Monat | 1 Credit je Markt und Region; reicht für ca. einen Abruf pro Tag über alle 7 Wettbewerbe | geplant |
| Understat / FBref | xG, xA | – | – | Nutzungsbedingungen und robots.txt noch zu prüfen | offen |
| Transfermarkt | Verträge, Marktwerte | – | – | Keine öffentliche API; Nutzung noch zu prüfen | offen |
| Offizielle Seiten (DFL, Vereine, Sender) | Sperren, Verletzungen, Übertragung | – | – | robots.txt und Bedingungen je Seite prüfen | offen |

### Buchmacher

Verglichen werden nur Tipico und Winamax. Pinnacle dient ausschließlich als
Referenz für die faire Quote und wird nie als beste Quote angezeigt oder
verlinkt, weil nach aktuellem Kenntnisstand keine deutsche Erlaubnis
vorliegt. Die GGL-Whitelist ist für alle drei noch zu prüfen
(`gglLicenseVerified` in `src/config/bookmakers.ts`).
