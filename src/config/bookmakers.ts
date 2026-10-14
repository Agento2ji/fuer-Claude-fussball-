/**
 * Buchmacher-Konfiguration.
 *
 * `showInComparison`: erscheint im sichtbaren Quotenvergleich. Nur zulässig
 *   für Anbieter mit deutscher Erlaubnis (GGL-Whitelist).
 * `useForFairPrice`: fließt in die faire Wahrscheinlichkeit (Konsens) ein.
 *
 * Lizenzstand geprüft am 13.10.2026 auf der amtlichen Whitelist der GGL
 * (§ 9 Abs. 8 GlüStV 2021). Die GGL veröffentlicht keine Erlaubnisnummern,
 * daher stehen hier Betreiber und Erlaubnisdaten.
 *
 * Pinnacle steht nicht auf der Whitelist. Er wird nur als Referenz für die
 * faire Quote genutzt und nie angezeigt oder verlinkt.
 *
 * `site`: „de“ = Quoten der deutschen Seite, so in Deutschland spielbar.
 * „ausland“ = Quoten einer ausländischen Seite eines Anbieters, der für
 * seine deutsche Seite eine Erlaubnis hat. The Odds API liefert die deutsche
 * Seite nicht; die Quoten sind nur ein Richtwert (andere Seite, ohne
 * deutsche Wettsteuer) und fließen nie in die Value-Tipps ein.
 */
export const GGL_WHITELIST_URL =
  "https://www.gluecksspiel-behoerde.de/de/fuer-spielende/uebersicht-erlaubter-anbieter-whitelist";

export interface GglPermission {
  operator: string;
  domain: string;
  firstPermission: string;
  followUpPermission: string | null;
  checkedAt: string;
}

export interface BookmakerConfig {
  key: string;
  name: string;
  /** Schlüssel bei The Odds API (Region `eu`). */
  oddsApiKey: string;
  site: "de" | "ausland";
  /** Bei Auslandsversionen: welche Seite die Quoten liefert, z. B. „UK“. */
  siteLabel?: string;
  showInComparison: boolean;
  useForFairPrice: boolean;
  /** null = nicht auf der Whitelist bzw. nicht verifiziert. */
  ggl: GglPermission | null;
}

export const BOOKMAKERS = [
  {
    key: "tipico",
    name: "Tipico",
    oddsApiKey: "tipico_de",
    site: "de",
    showInComparison: true,
    useForFairPrice: true,
    ggl: {
      operator: "Tipico Co. Limited",
      domain: "tipico.de",
      firstPermission: "2020-10-09",
      followUpPermission: "2022-12-09",
      checkedAt: "2026-10-13",
    },
  },
  {
    key: "winamax",
    name: "Winamax",
    oddsApiKey: "winamax_de",
    site: "de",
    showInComparison: true,
    useForFairPrice: true,
    ggl: {
      operator: "WINAMAX (Société anonyme)",
      domain: "winamax.de",
      firstPermission: "2021-06-29",
      followUpPermission: "2022-12-08",
      checkedAt: "2026-10-13",
    },
  },
  {
    key: "pinnacle",
    name: "Pinnacle",
    oddsApiKey: "pinnacle",
    site: "ausland",
    showInComparison: false,
    useForFairPrice: true,
    ggl: null,
  },
  // Auslandsversionen (Whitelist geprüft am 14.10.2026, Sportwetten-Erlaubnis
  // jeweils für die deutsche Domain).
  {
    key: "betway",
    name: "Betway",
    oddsApiKey: "betway",
    site: "ausland",
    siteLabel: "UK",
    showInComparison: true,
    useForFairPrice: true,
    ggl: {
      operator: "Betway Limited",
      domain: "betway.de",
      firstPermission: "2021-03-09",
      followUpPermission: "2022-12-23",
      checkedAt: "2026-10-14",
    },
  },
  {
    key: "betano",
    name: "Betano",
    oddsApiKey: "betano_uk",
    site: "ausland",
    siteLabel: "UK",
    showInComparison: true,
    useForFairPrice: true,
    ggl: {
      operator: "Betkick Sportsbetting Limited",
      domain: "betano.de",
      firstPermission: "2021-02-19",
      followUpPermission: "2022-12-16",
      checkedAt: "2026-10-14",
    },
  },
  {
    key: "leovegas",
    name: "LeoVegas",
    oddsApiKey: "leovegas",
    site: "ausland",
    siteLabel: "UK",
    showInComparison: true,
    useForFairPrice: true,
    ggl: {
      operator: "LVSports Limited",
      domain: "leovegas.de",
      firstPermission: "2024-10-21",
      followUpPermission: null,
      checkedAt: "2026-10-14",
    },
  },
] as const satisfies readonly BookmakerConfig[];

/** Sicherheitsnetz: Ohne deutsche Erlaubnis nie im Vergleich. */
export function isComparable(b: BookmakerConfig): boolean {
  return b.showInComparison && b.ggl !== null;
}

/** Quote ist genau so in Deutschland spielbar – nur diese zählen für Value-Tipps. */
export function isPlayableInGermany(b: BookmakerConfig): boolean {
  return isComparable(b) && b.site === "de";
}

/** Anzeigename, bei Auslandsversionen mit Seite, z. B. „Betway (UK)“. */
export function bookmakerLabel(b: BookmakerConfig): string {
  return b.site === "ausland" && b.siteLabel ? `${b.name} (${b.siteLabel})` : b.name;
}
