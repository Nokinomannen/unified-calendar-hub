import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

const CRED_KEY = "one-auto-creds";

export function saveAutoCreds(email: string, password: string) {
  try { localStorage.setItem(CRED_KEY, JSON.stringify({ email, password })); } catch {}
}

function readAutoCreds(): { email: string; password: string } | null {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session);
        setLoading(false);
        return;
      }
      // No session — try auto sign-in with stored creds
      const creds = readAutoCreds();
      if (creds) {
        const { data: signedIn } = await supabase.auth.signInWithPassword(creds);
        setSession(signedIn.session ?? null);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          try { localStorage.removeItem(CRED_KEY); } catch {}
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
