import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/session-cookie";

const PUBLIC = [
  "/login", "/invite/",
  "/vet/", "/owner/", "/landowner/",
  // The invite link and first run. Both are shells: every byte of data they
  // show comes from /api/portal/*, which is gated on the portal cookie, so
  // reaching the page without one shows nothing.
  "/welcome/", "/onboarding",
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
  // Redeeming a magic link — the token in the body IS the credential, so this
  // one cannot require the cookie it is about to set.
  "/api/portal/accept",
  "/api/portals/owner/verify",
  "/api/portals/owner/session",
  "/api/vet/verify",
  "/api/vet/setup",
  "/api/vet/session",
  "/api/webhooks/",
  // ICS calendar feed: Google fetches it with no cookies, so the secret token
  // in the path is the credential rather than a session.
  "/api/calendar/",
  // Vercel cron and Resend's inbound webhook both arrive without a session.
  // Neither is actually unauthenticated: cron routes check CRON_SECRET on the
  // Authorization header, and the inbound webhook verifies its Svix signature
  // before reading a byte of the payload. Both refuse outright when their
  // secret is unset rather than falling open.
  "/api/cron/",
  // Vapi reaches in mid-call to run a tool, and its servers carry no cookie of
  // ours. The route checks a shared secret on every request and returns 503
  // when that secret is unset, so an unconfigured deploy answers nobody.
  "/api/rancher-ai/voice-webhook",
];

// Which cookie gates which API prefix, and whether that cookie carries an
// HMAC we can verify here. First match wins, so the owner/vet prefixes must
// be tested before the admin fallback.
//
// The vet cookie is checked for presence only: it holds a random token that
// is validated against vet_invites inside the route, so it is already
// unguessable and does not need signing.
// Each prefix lists every cookie that may open it. More than one because the
// portal session replaced two older ones: an owner signed in before the change
// still holds brandbook_owner_session, and expiring everybody to ship a
// refactor is a poor trade. The old cookies age out on their own 90 days.
const API_GATES: Array<[prefix: string, cookies: Array<[name: string, signed: boolean]>]> = [
  // The unified portal session holds a membership id — person, ranch and role
  // in one — so a vet who works with several outfits is a different session
  // per outfit rather than a different account.
  ["/api/portal/",        [["brandbook_portal_session", true]]],
  ["/api/portals/owner/", [["brandbook_portal_session", true], ["brandbook_owner_session", true]]],
  ["/api/vet/",           [["brandbook_portal_session", true], ["brandbook_vet_session", false]]],
];

async function cookieValid(req: NextRequest, name: string, signed: boolean) {
  const raw = req.cookies.get(name)?.value;
  if (!signed) return Boolean(raw);
  return (await verifySessionValue(raw)) !== null;
}

async function hasValidSession(req: NextRequest, accepted: Array<[string, boolean]>) {
  for (const [name, signed] of accepted) {
    if (await cookieValid(req, name, signed)) return true;
  }
  return false;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.some(p => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    const gate = API_GATES.find(([prefix]) => pathname.startsWith(prefix));
    const accepted: Array<[string, boolean]> = gate
      ? gate[1]
      : [["brandbook_session", true]];
    if (!(await hasValidSession(req, accepted))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isPublic = PUBLIC.some(p => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();
  if (!(await hasValidSession(req, [["brandbook_session", true]]))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
