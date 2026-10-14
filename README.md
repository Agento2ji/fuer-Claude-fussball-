# Fußball-Hub

Spielerstatus, Statistik, Formbewertung, Quotenvergleich und Übertragungsinfos
für Premier League, Bundesliga, Serie A, LaLiga, Ligue 1, Champions League und
Europa League (jeweils laufende Saison). Lernprojekt, läuft lokal oder privat
online hinter einem Passwort – nicht öffentlich.

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
| `npm run test:e2e` | E2E-Tests inkl. Barrierefreiheit (vorher `npm run build` und `npm run ingest -- testdaten`) |

## Online (privat, mit Passwort)

Kostenlos über Vercel (App) und Neon (Postgres). Die ganze Seite ist per
Passwort geschützt und für Suchmaschinen gesperrt (`src/middleware.ts`),
solange die Veröffentlichungs-Checkliste aus Abschnitt 8 nicht erledigt ist.

1. **Neon:** Konto anlegen, Projekt in Region *Frankfurt (eu-central-1)*,
   Verbindungs-String mit „Connection pooling“ kopieren
   (`postgresql://…-pooler.…/neondb?sslmode=require`).
2. **GitHub:** Repository → Settings → Secrets and variables → Actions →
   Secret `DATABASE_URL` mit diesem String anlegen.
3. **Daten:** Actions → „Daten“ → „Run workflow“. Der Job migriert, seedet
   und ruft Spiele (und auf Wunsch die Testliga) ab; danach täglich um
   04:17 UTC von selbst.
4. **Vercel:** Konto mit GitHub anlegen, dieses Repository importieren und
   unter Environment Variables setzen: `DATABASE_URL` (derselbe String),
   `SITE_USER` (frei wählbar, Standard `fussball`) und `SITE_PASSWORD`
   (mindestens 12 Zeichen). Deploy.

Ohne `SITE_PASSWORD` ist die Seite offen – lokal gewollt, online nicht.
Neue Commits auf `main` werden von Vercel automatisch ausgeliefert.

Die Server-Funktionen laufen in Frankfurt (`vercel.json`, Region `fra1`),
neben der Datenbank – Vercels Standard wäre Washington, und jede Abfrage
müsste über den Atlantik. Aus demselben Grund schreibt die Ingestion
gebündelt (viele Zeilen je Statement): Der Abruf aus GitHub Actions (USA)
dauert so rund eine Minute statt über einer Viertelstunde.

## Seiten

| Pfad | Inhalt |
| --- | --- |
| `/` | Nächste Spiele und Wettbewerbe mit Datenstand |
| `/wettbewerbe/[code]` | Tabelle (aus Ergebnissen berechnet) und nächste Spiele |
| `/teams/[id]` | Platz, Punkte, Form, nächstes Spiel, Ausfälle, Teamstatistik, Kader |
| `/quoten`, `/spiele/[id]/quoten` | Quotenübersicht und Vergleich je Spiel (ab 18) |
| `/spiele/[id]` | Paarung, Countdown, Übertragung, Form, Ausfälle, Aufstellungen mit Form, direkter Vergleich |
| `/spieler` und `/spieler/[id]` | Kaderliste und Spielerseite mit Status, Sperrgefahr, Statistik, Vertrag |

Jede angezeigte Zahl ist antippbar und zeigt Quelle und Abrufzeitpunkt.
Testdaten sind auf jeder Seite deutlich gekennzeichnet. Suche über Spieler,
Teams und Spiele aus jedem Bildschirm mit `/` oder `Strg/⌘ + K`.

## Formbewertung

Nachvollziehbar gerechnet nach Abschnitt 5 der Vorgabe, Code in
`src/lib/form.ts`, alle Schwellen und Gewichte in `src/config/form.ts`:

1. Kennzahlen je Spiel auf 90 Minuten normiert, positionsabhängig gewichtet.
2. z-Werte gegen dieselbe Position im selben Wettbewerb und derselben Saison,
   plus Ligastärke als Verschiebung.
3. Aktuelle Form = Mittel der letzten 5 Pflichtspiele mit ≥ 30 Minuten
   (mindestens 3, aus den letzten 120 Tagen).
4. Perzentil gegen alle gleich langen Abschnitte der erfassten Karriere:
   unter 25 schlecht, 25–60 mittel, 60–90 gut, über 90 Bestform.

Annahmen, die nicht aus der Vorgabe stammen (Gewichte für Mittelfeld und
Torhüter, Ligastärken, 120-Tage-Grenze, Hinweis bei unter 20 Abschnitten),
sind in der Konfiguration mit `ANNAHME` markiert.

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

Übertragung: Sender werden nur aus geprüften Quellen angezeigt. Eine
Ableitung aus Sendeplatz-Regeln der Rechtevergabe ist bewusst nicht
eingebaut, weil sie sich je Spiel nicht verlässlich belegen lässt.

### Buchmacher

Verglichen werden Tipico und Winamax. Beide haben eine deutsche Erlaubnis für
Sportwetten (GGL-Whitelist, geprüft am 13.10.2026: Tipico Co. Limited seit
09.10.2020, WINAMAX SA seit 29.06.2021). Pinnacle steht nicht auf der
Whitelist und dient nur als Referenz für die faire Quote – nie angezeigt,
nie verlinkt. Die GGL veröffentlicht keine Erlaubnisnummern.

## Quoten und Value

Code in `src/lib/odds/`, Parameter in `src/config/value.ts`:

1. Marge je Anbieter entfernen: Power (Hauptmethode), proportional und Shin zum Vergleich.
2. Faire Wahrscheinlichkeit = Konsens aller Anbieter, gewichtet mit 1 / Marge.
3. EV = faire Wahrscheinlichkeit × beste Quote eines zugelassenen Anbieters − 1.
4. Kelly f = (p·q − 1) / (q − 1), angezeigt wird ein Viertel.
5. Nur EV ≥ 2 %; Top 3 nach EV je Schwankung der Auszahlung.
6. Quoten älter als 15 Minuten werden als veraltet gekennzeichnet.

Jugendschutz und Spielerschutz (Abschnitt 8): Altersabfrage (18+) serverseitig
vor jedem Quotenbereich, dauerhafter Hinweis auf die Beratung des BIÖG
(früher BZgA, 0800 1 37 27 00, check-dein-spiel.de), keine Affiliate-Links,
nüchterne Sprache ohne Tipps oder Gewinnversprechen. Impressum, Datenschutz
und Cookie-Banner fehlen noch – die Seite läuft daher nur lokal oder online
hinter einem Passwort.

## Testdaten

`npm run ingest -- testdaten` spielt eine erfundene „Testliga“ ein: 6 fiktive
Vereine, 108 fiktive Spieler, die laufende Saison plus drei Vorsaisons (für
den Karrierevergleich der Formbewertung) mit Statistik, Verletzungen, Sperren,
Verträgen, Übertragungen und Quoten. Bewusst keine echten Namen – eine
erfundene Verletzung eines echten Spielers wäre eine Falschinformation.

Testdaten tragen die Quelle `testdaten`, der Wettbewerb ist mit
`is_test_data` markiert, und die UI kennzeichnet sie. Sie stehen in keiner
Fallback-Kette und landen nie automatisch im Produktivpfad.

## Qualität

- **Tests:** Unit- und Integrationstests (`npm test`), E2E-Tests in
  Handyansicht inklusive axe-Prüfung auf WCAG 2.1 AA in hell und dunkel
  (`npm run test:e2e`). Beides läuft in der CI bei jedem Push.
- **Lighthouse (Handy, Produktions-Build, 13.10.2026):** Performance 92–99,
  Barrierefreiheit, Best Practices und SEO je 100. Ausnahme: SEO der
  Quotenseiten, die bewusst `noindex` tragen.
- **Ladeverhalten:** Skelett-Zustände statt Spinner; Diagramme werden nach
  dem ersten Rendern nachgeladen, damit langsame Handys die Seite sofort sehen.

## Offene Punkte

| Thema | Stand | Was es braucht |
| --- | --- | --- |
| Echte Spielerdaten, Ausfälle, Aufstellungen | nur Testdaten | kostenlose Keys für API-Football bzw. football-data.org |
| Echte Quoten | nur Testdaten | kostenloser Key für The Odds API (500 Credits/Monat ≈ ein Abruf pro Tag) |
| Champions und Europa League | keine Quelle | Key für football-data.org oder API-Football |
| Senderangaben für echte Spiele | keine geprüfte Quelle | Entscheidung, ob eine belegte Rechte-Übersicht genügt |
| Scraper offizieller Seiten | nicht gebaut | Prüfung der Nutzungsbedingungen je Seite |
| Regelmäßige Abrufe | täglich per GitHub Actions (`daten.yml`), nur Spiele und Testliga | Quoten erst mit Key für The Odds API |
| Veröffentlichung | lokal oder privat online mit Passwort | Impressum, Datenschutzerklärung, Cookie-Banner, Rechtelage für Logos; Checkliste aus Abschnitt 8 gemeinsam durchgehen |

Ideen aus Abschnitt 12, die auf der Datenbasis direkt aufsetzen: Quotenbewegung
als Kurve (`odds_snapshots` ist append-only), Rückrechnung der Value-Hinweise,
Vertragsablauf-Radar und Vergleichsansicht zweier Spieler.
