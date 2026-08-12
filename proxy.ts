import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/session-cookie";

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

// Which cookie gates which API prefix, and whether that cookie carries an
// HMAC we can verify here. First match wins, so the owner/vet prefixes must
// be tested before the admin fallback.
//
// The vet cookie is checked for presence only: it holds a random token that
// is validated against vet_invites inside the route, so it is already
// unguessable and does not need signing.
const API_GATES: Array<[prefix: string, cookie: string, signed: boolean]> = [
  ["/api/portals/owner/", "brandbook_owner_session", true],
  ["/api/vet/",           "brandbook_vet_session",   false],
];

async function hasValidSession(req: NextRequest, cookie: string, signed: boolean) {
  const raw = req.cookies.get(cookie)?.value;
  if (!signed) return Boolean(raw);
  return (await verifySessionValue(raw)) !== null;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.some(p => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    const gate = API_GATES.find(([prefix]) => pathname.startsWith(prefix));
    const cookie = gate ? gate[1] : "brandbook_session";
    const signed = gate ? gate[2] : true;
    if (!(await hasValidSession(req, cookie, signed))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isPublic = PUBLIC.some(p => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();
  if (!(await hasValidSession(req, "brandbook_session", true))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
