import { PROVIDER_CHAINS } from "@/config/providers";
import { FootballDataProvider } from "./providers/football-data";
import { OpenfootballProvider } from "./providers/openfootball";
import { TheOddsApiProvider } from "./providers/the-odds-api";
import type { MatchProvider, OddsProvider } from "./types";

/** Alle implementierten Anbieter je Datenart, nach Schlüssel. */
const MATCH_PROVIDERS: Record<string, () => MatchProvider> = {
  "football-data": () => new FootballDataProvider(),
  openfootball: () => new OpenfootballProvider(),
};

const ODDS_PROVIDERS: Record<string, () => OddsProvider> = {
  "the-odds-api": () => new TheOddsApiProvider(),
};

function build<T>(chain: readonly string[], factories: Record<string, () => T>): T[] {
  return chain.map((key) => {
    const factory = factories[key];
    if (!factory) throw new Error(`Kein Adapter für Anbieter „${key}“ implementiert`);
    return factory();
  });
}

export const matchProviders = () => build(PROVIDER_CHAINS.matches, MATCH_PROVIDERS);
export const oddsProviders = () => build(PROVIDER_CHAINS.odds, ODDS_PROVIDERS);
