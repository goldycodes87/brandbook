import { NextRequest, NextResponse } from "next/server";

const PUBLIC = [
  "/login", "/invite/", "/api/",
  "/vet/", "/owner/", "/landowner/",
  "/offline", "/_next/", "/favicon",
  "/icon", "/manifest", "/apple",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some(p => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();
  const session = req.cookies.get("brandbook_session")?.value;
  if (session !== "authenticated") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
