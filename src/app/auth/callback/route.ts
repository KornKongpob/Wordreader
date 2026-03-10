import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/supabase/ensureProfile";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await ensureProfile(supabase, user);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something goes wrong, redirect to auth page
  return NextResponse.redirect(`${origin}/auth`);
}
