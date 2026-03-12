import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/api/analyze-sentence") ||
    pathname.startsWith("/api/chunk-text") ||
    pathname.startsWith("/api/detect-idioms") ||
    pathname.startsWith("/api/quiz") ||
    pathname.startsWith("/read/offline")
  ) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes that don't need auth
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|api/extract|api/translate|api/analyze-sentence|api/chunk-text|api/detect-idioms|api/quiz).*)",
  ],
};
