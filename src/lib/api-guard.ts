import { NextResponse, type NextRequest } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";
import { createClient } from "@/lib/supabase/server";
import { takeRateLimit } from "@/lib/rate-limit";

interface GuardOptions {
  routeId: string;
  limit: number;
  windowMs: number;
}

export function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export async function guardAuthenticatedRequest(
  _request: NextRequest,
  options: GuardOptions
) {
  const supabase = await createClient();
  const { user, error } = await getUserWithProfile(supabase);

  if (!user || error) {
    return {
      response: noStoreJson(
        { error: "Please sign in to continue." },
        { status: 401 }
      ),
    };
  }

  const rateLimit = takeRateLimit(
    `${options.routeId}:${user.id}`,
    options.limit,
    options.windowMs
  );

  if (!rateLimit.allowed) {
    return {
      response: noStoreJson(
        {
          error: `Too many requests. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimit.retryAfterSeconds.toString(),
          },
        }
      ),
    };
  }

  return { supabase, user };
}
