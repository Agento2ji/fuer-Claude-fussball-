import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/basic-auth";

/**
 * Passwortschutz für die ganze Seite, sobald SITE_PASSWORD gesetzt ist
 * (online). Lokal ohne SITE_PASSWORD bleibt alles offen.
 */
export function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();
  const user = process.env.SITE_USER || "fussball";
  if (isAuthorized(request.headers.get("authorization"), user, password)) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
  return new NextResponse("Anmeldung erforderlich.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Fussball-Hub", charset="UTF-8"',
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
