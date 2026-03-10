"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";

let bootstrappedUserId: string | null = null;

export default function ProfileBootstrap() {
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let isMounted = true;

    const ensureActiveProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user) return;
      if (bootstrappedUserId === user.id) return;

      const { error } = await getUserWithProfile(supabase);
      if (!isMounted) return;

      if (!error) {
        bootstrappedUserId = user.id;
      } else {
        console.warn("WordReader profile bootstrap failed:", error);
      }
    };

    void ensureActiveProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
