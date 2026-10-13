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
    showInComparison: false,
    useForFairPrice: true,
    ggl: null,
  },
] as const satisfies readonly BookmakerConfig[];

/** Sicherheitsnetz: Ohne deutsche Erlaubnis nie im Vergleich. */
export function isComparable(b: BookmakerConfig): boolean {
  return b.showInComparison && b.ggl !== null;
}
