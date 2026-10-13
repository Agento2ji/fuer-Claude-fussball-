import { NextResponse } from "next/server";
import { z } from "zod";
import { search } from "@/lib/queries/search";

export const dynamic = "force-dynamic";

const querySchema = z.object({ q: z.string().max(80).default("") });

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Suchanfrage" }, { status: 400 });
  return NextResponse.json(await search(parsed.data.q));
}
