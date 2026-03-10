import type { SupabaseClient, User } from "@supabase/supabase-js";

function getProfileDisplayName(user: User) {
  const displayName = user.user_metadata?.display_name;
  const fullName = user.user_metadata?.full_name;

  if (typeof displayName === "string" && displayName.trim()) {
    return displayName.trim();
  }

  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  return user.email?.split("@")[0] ?? null;
}

function getProfileEmail(user: User) {
  return user.email ?? `${user.id}@wordreader.local`;
}

export async function ensureProfile(
  supabase: SupabaseClient,
  user: User
) {
  const { data: existingProfile, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (lookupError) {
    return { error: lookupError.message };
  }

  if (!existingProfile) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: getProfileEmail(user),
      display_name: getProfileDisplayName(user),
      updated_at: new Date().toISOString(),
    });

    if (insertError && insertError.code !== "23505") {
      return { error: insertError.message };
    }
  }

  return { error: null };
}

export async function getUserWithProfile(supabase: SupabaseClient) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { user: null, error: authError.message };
  }

  if (!user) {
    return { user: null, error: "Please sign in again." };
  }

  const { error } = await ensureProfile(supabase, user);
  return { user, error };
}
