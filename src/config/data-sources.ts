/**
 * Datenquellen mit Priorität. Bei widersprüchlichen Werten gewinnt die
 * Quelle mit der kleineren Zahl; der Konflikt wird geloggt.
 *
 * Status `geplant` heißt: Nutzungsbedingungen und Abdeckung sind noch
 * nicht geprüft, die Quelle wird noch nicht abgefragt.
 */
export type DataSourceKind =
  | "api"
  | "official_site"
  | "open_data"
  | "scrape"
  | "testdaten";
export type DataSourceStatus = "aktiv" | "geplant" | "verworfen";

export interface DataSourceConfig {
  key: string;
  name: string;
  kind: DataSourceKind;
  baseUrl: string;
  priority: number;
  status: DataSourceStatus;
  licenseNote: string;
}

export const DATA_SOURCES = [
  {
    key: "football-data",
    name: "football-data.org",
    kind: "api",
    baseUrl: "https://api.football-data.org/v4",
    priority: 20,
    status: "geplant",
    licenseNote:
      "Kostenloser Tarif: 12 Wettbewerbe (ohne Europa League), 10 Abrufe/Minute, nur Spielpläne, Tabellen, verzögerte Ergebnisse.",
  },
  {
    key: "api-football",
    name: "API-Football (api-sports.io)",
    kind: "api",
    baseUrl: "https://v3.football.api-sports.io",
    priority: 10,
    status: "geplant",
    licenseNote:
      "Kostenloser Tarif: 100 Abrufe/Tag. Zugriff auf laufende Saison und Verletzungsdaten noch mit eigenem Key zu prüfen.",
  },
  {
    key: "the-odds-api",
    name: "The Odds API",
    kind: "api",
    baseUrl: "https://api.the-odds-api.com/v4",
    priority: 10,
    status: "geplant",
    licenseNote:
      "Kostenloser Tarif: 500 Credits/Monat (1 Credit je Markt und Region). Führt tipico_de, winamax_de, pinnacle in Region eu.",
  },
  {
    key: "openfootball",
    name: "openfootball (football.json)",
    kind: "open_data",
    baseUrl: "https://raw.githubusercontent.com/openfootball/football.json/master",
    priority: 30,
    status: "aktiv",
    licenseNote:
      "Gemeinfrei (CC0-1.0). Spielpläne und Endergebnisse der Top-5-Ligen, ohne Champions/Europa League. Ergebnisse teils mehrere Wochen verzögert, Anstoßzeit nicht immer angegeben.",
  },
  {
    key: "testdaten",
    name: "Testdaten (erfunden)",
    kind: "testdaten",
    baseUrl: "local://testdaten",
    priority: 99,
    status: "aktiv",
    licenseNote:
      "Erfundene Daten für Entwicklung und Entwurf. Nie im Produktivpfad, in der UI immer als Testdaten gekennzeichnet.",
  },
] as const satisfies readonly DataSourceConfig[];

export type DataSourceKey = (typeof DATA_SOURCES)[number]["key"];
