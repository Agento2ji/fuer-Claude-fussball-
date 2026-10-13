/**
 * Buchmacher-Konfiguration.
 *
 * `showInComparison`: erscheint im sichtbaren Quotenvergleich. Das ist nur
 *   für Anbieter mit deutscher Erlaubnis (GGL-Whitelist) zulässig.
 * `useForFairPrice`: fließt in die faire Wahrscheinlichkeit (Konsens) ein.
 *
 * Pinnacle hat nach aktuellem Kenntnisstand keine deutsche Erlaubnis. Er wird
 * deshalb nur als Referenz für die faire Quote genutzt und nie als
 * „beste Quote“ angezeigt oder verlinkt.
 *
 * `gglLicenseVerified` bleibt `false`, bis die Whitelist der GGL geprüft und
 * die Lizenzangabe hier eingetragen ist.
 */
export interface BookmakerConfig {
  key: string;
  name: string;
  /** Schlüssel bei The Odds API (Region `eu`). */
  oddsApiKey: string;
  showInComparison: boolean;
  useForFairPrice: boolean;
  gglLicenseVerified: boolean;
}

export const BOOKMAKERS = [
  {
    key: "tipico",
    name: "Tipico",
    oddsApiKey: "tipico_de",
    showInComparison: true,
    useForFairPrice: true,
    gglLicenseVerified: false,
  },
  {
    key: "winamax",
    name: "Winamax",
    oddsApiKey: "winamax_de",
    showInComparison: true,
    useForFairPrice: true,
    gglLicenseVerified: false,
  },
  {
    key: "pinnacle",
    name: "Pinnacle",
    oddsApiKey: "pinnacle",
    showInComparison: false,
    useForFairPrice: true,
    gglLicenseVerified: false,
  },
] as const satisfies readonly BookmakerConfig[];
