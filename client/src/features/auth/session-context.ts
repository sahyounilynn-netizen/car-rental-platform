import { createContext } from "react";
import type { AuthResponse, User } from "@/types";

export type SessionState = {
  ready: boolean;
  token: string | null;
  user: User | null;
};

export interface SessionContextValue {
  session: SessionState;
  applySession: (result: AuthResponse) => void;
  clearSession: () => void;
  updateUser: (user: User) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
