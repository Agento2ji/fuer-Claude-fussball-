import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kein schwebendes Next.js-Symbol im Entwicklungsmodus, es verdeckt Inhalte auf dem Handy.
  devIndicators: false,
  // Metadaten (Titel, Beschreibung) immer im <head> statt nachgestreamt.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
