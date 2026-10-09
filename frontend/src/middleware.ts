// ABOUTME: Edge middleware. Authentication is disabled, so the old login route just redirects to the case list.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL("/cases", request.url));
}

export const config = {
  matcher: ["/login"],
};
