import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import type { AuthResponse, User } from "@/types";
import { SessionContext } from "@/features/auth/session-context";
import type { SessionState } from "@/features/auth/session-context";

const TOKEN_STORAGE_KEY = "car-rental-access-token";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    ready: false,
    token: localStorage.getItem(TOKEN_STORAGE_KEY),
    user: null,
  });

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

      if (storedToken) {
        try {
          const result = await api.me(storedToken);
          if (!active) return;
          setSession({ ready: true, token: storedToken, user: result.user });
          return;
        } catch {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      }

      try {
        const refreshed = await api.refresh();
        if (!active) return;
        localStorage.setItem(TOKEN_STORAGE_KEY, refreshed.accessToken);
        setSession({ ready: true, token: refreshed.accessToken, user: refreshed.user });
      } catch {
        if (!active) return;
        setSession({ ready: true, token: null, user: null });
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const applySession = useCallback((result: AuthResponse) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, result.accessToken);
    setSession({ ready: true, token: result.accessToken, user: result.user });
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setSession({ ready: true, token: null, user: null });
  }, []);

  const updateUser = useCallback((user: User) => {
    setSession((current) => ({ ...current, user }));
  }, []);

  return (
    <SessionContext.Provider value={{ session, applySession, clearSession, updateUser }}>
      {children}
    </SessionContext.Provider>
  );
}
