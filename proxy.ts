import { NextRequest, NextResponse } from "next/server";

const PUBLIC = [
  "/login", "/invite/",
  "/vet/", "/owner/", "/landowner/",
  "/offline", "/_next/", "/favicon",
  "/icon", "/manifest", "/apple",
];

// API endpoints that MUST stay reachable without a session:
// login/logout, invite acceptance, portal magic-link bootstrap,
// and external Square webhooks.
const PUBLIC_API = [
  "/api/auth/session",
  "/api/auth/logout",
  "/api/invite",
  "/api/portal/verify",
  "/api/portals/owner/verify",
  "/api/portals/owner/session",
  "/api/vet/verify",
  "/api/vet/setup",
  "/api/vet/session",
  "/api/webhooks/",
];

// Which cookie gates which API prefix. First match wins, so the
// owner/vet prefixes must be tested before the admin fallback.
const API_GATES: Array<[string, string]> = [
  ["/api/portals/owner/", "brandbook_owner_session"],
  ["/api/vet/", "brandbook_vet_session"],
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.some(p => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    const gate = API_GATES.find(([prefix]) => pathname.startsWith(prefix));
    const cookieName = gate ? gate[1] : "brandbook_session";
    if (!req.cookies.get(cookieName)?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isPublic = PUBLIC.some(p => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();
  const session = req.cookies.get("brandbook_session")?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
