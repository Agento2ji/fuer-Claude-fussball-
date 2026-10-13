const de1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function marketLabel(market: string, line: number | null): string {
  switch (market) {
    case "h2h":
      return "Ergebnis (1X2)";
    case "totals":
      return `Über/Unter ${line === null ? "" : de1.format(line)} Tore`;
    case "btts":
      return "Beide Teams treffen";
    case "double_chance":
      return "Doppelte Chance";
    case "handicap":
      return `Handicap ${line === null ? "" : de1.format(line)}`;
    default:
      return market;
  }
}

export function selectionLabel(market: string, selection: string, line: number | null, home: string, away: string): string {
  if (market === "h2h") return selection === "home" ? `Sieg ${home}` : selection === "away" ? `Sieg ${away}` : "Unentschieden";
  if (market === "totals") return `${selection === "over" ? "Über" : "Unter"} ${line === null ? "" : de1.format(line)} Tore`;
  if (market === "btts") return selection === "yes" ? "Beide treffen: Ja" : "Beide treffen: Nein";
  return selection;
}
