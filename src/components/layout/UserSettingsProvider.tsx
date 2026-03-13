"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";
import {
  DEFAULT_USER_SETTINGS,
  USER_SETTINGS_SELECT,
  coerceUserSettings,
  toUserSettingsUpdate,
  type SyncedUserSettings,
} from "@/lib/user-settings";
import type { UserSettings } from "@/types";

interface UserSettingsContextValue {
  settings: SyncedUserSettings;
  isReady: boolean;
  isAuthenticated: boolean;
  updateSettings: (next: Partial<SyncedUserSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextValue>({
  settings: DEFAULT_USER_SETTINGS,
  isReady: false,
  isAuthenticated: false,
  updateSettings: async () => {},
  refreshSettings: async () => {},
});

export function useUserSettings() {
  return useContext(UserSettingsContext);
}

interface UserSettingsProviderProps {
  children: React.ReactNode;
  initialSettings?: Partial<UserSettings> | null;
}

export function UserSettingsProvider({
  children,
  initialSettings,
}: UserSettingsProviderProps) {
  const [settings, setSettings] = useState(() => coerceUserSettings(initialSettings));
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const refreshSettings = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setIsAuthenticated(false);
      setSettings(DEFAULT_USER_SETTINGS);
      setIsReady(true);
      return;
    }

    const { user, error } = await getUserWithProfile(supabase);
    if (!user || error) {
      userIdRef.current = null;
      setIsAuthenticated(false);
      setSettings(DEFAULT_USER_SETTINGS);
      setIsReady(true);
      return;
    }

    userIdRef.current = user.id;
    setIsAuthenticated(true);

    const { data } = await supabase
      .from("user_settings")
      .select(USER_SETTINGS_SELECT)
      .eq("user_id", user.id)
      .maybeSingle();

    setSettings(coerceUserSettings(data as Partial<UserSettings> | null));
    setIsReady(true);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const boot = async () => {
      await refreshSettings();
      if (!isMounted) {
        return;
      }
    };

    void boot();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshSettings();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshSettings]);

  useEffect(() => {
    document.documentElement.lang = settings.uiLanguage;
  }, [settings.uiLanguage]);

  const updateSettings = useCallback(async (next: Partial<SyncedUserSettings>) => {
    const previousSettings = settingsRef.current;
    const mergedSettings = { ...previousSettings, ...next };
    setSettings(mergedSettings);

    const supabase = createClient();
    const userId = userIdRef.current;
    if (!supabase || !userId) {
      return;
    }

    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        ...toUserSettingsUpdate(next),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("Failed to sync user settings:", error);
      setSettings(previousSettings);
    }
  }, []);

  const value = useMemo(
    () => ({
      settings,
      isReady,
      isAuthenticated,
      updateSettings,
      refreshSettings,
    }),
    [isAuthenticated, isReady, refreshSettings, settings, updateSettings]
  );

  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
}
