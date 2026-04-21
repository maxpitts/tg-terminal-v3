import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/chart") && !pathname.startsWith("/multichart")) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Has valid session — let them in regardless of tier for now
  // Tier gating can be done client-side in the chart
  return NextResponse.next();
}

export const config = { matcher: ["/chart/:path*", "/multichart"] };
