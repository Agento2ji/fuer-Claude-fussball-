"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBerlin } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface SourceInfo {
  name: string;
  fetchedAt: Date;
  url: string | null;
  isTestData: boolean;
}

/**
 * Macht jeden Wert antippbar: zeigt Quelle und Abrufzeitpunkt.
 * Ohne Farbe als einzigen Hinweis – der Wert bleibt normal lesbar.
 */
export function Sourced({
  source,
  children,
  className,
  label,
}: {
  source: SourceInfo;
  children: ReactNode;
  className?: string;
  /** Wofür der Wert steht, für Screenreader. */
  label?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "cursor-help rounded-sm underline decoration-muted-foreground/30 decoration-dotted underline-offset-4 hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-ring",
          className,
        )}
        aria-label={label ? `${label}: Quelle anzeigen` : "Quelle anzeigen"}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-64 text-xs" align="start">
        <SourceDetails source={source} />
      </PopoverContent>
    </Popover>
  );
}

export function SourceDetails({ source }: { source: SourceInfo }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <dt className="text-muted-foreground">Quelle</dt>
      <dd>
        {source.url ? (
          <a href={source.url} className="underline" target="_blank" rel="noreferrer">
            {source.name}
          </a>
        ) : (
          source.name
        )}
      </dd>
      <dt className="text-muted-foreground">Stand</dt>
      <dd>{formatBerlin(new Date(source.fetchedAt))}</dd>
      {source.isTestData && (
        <dd className="col-span-2 mt-1 font-medium text-status-warn">
          Erfundene Testdaten – kein echter Spieler.
        </dd>
      )}
    </dl>
  );
}

/** Dezenter Quellenhinweis unter einem Block. */
export function SourceFootnote({ source }: { source: SourceInfo }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <Info className="size-3" aria-hidden />
        {source.name} · {formatBerlin(new Date(source.fetchedAt), { dateStyle: "short", timeStyle: "short" })}
      </PopoverTrigger>
      <PopoverContent className="w-64 text-xs" align="start">
        <SourceDetails source={source} />
      </PopoverContent>
    </Popover>
  );
}
