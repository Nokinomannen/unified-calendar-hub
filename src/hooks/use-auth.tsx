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

/**
 * Mobile Safari can wipe localStorage after a period of inactivity, which logs
 * the user out. We mirror the credentials into a long-lived cookie so the app
 * can silently sign back in instead of showing the login form every time.
 */
function writeCookie(value: string) {
  try {
    document.cookie = `${CRED_KEY}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`;
  } catch {}
}

function readCookie(): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${CRED_KEY}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

export function saveAutoCreds(email: string, password: string) {
  const raw = JSON.stringify({ email, password });
  try { localStorage.setItem(CRED_KEY, raw); } catch {}
  writeCookie(raw);
}

export function readAutoCreds(): { email: string; password: string } | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(CRED_KEY); } catch {}
  if (!raw) raw = readCookie();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { email: string; password: string };
    // Re-seed whichever store lost it.
    try { localStorage.setItem(CRED_KEY, raw); } catch {}
    writeCookie(raw);
    return parsed;
  } catch { return null; }
}

/** Signs back in with the remembered credentials. Returns true on success. */
export async function tryAutoSignIn(): Promise<boolean> {
  const creds = readAutoCreds();
  if (!creds) return false;
  const { data } = await supabase.auth.signInWithPassword(creds);
  return !!data.session;
}

function clearAutoCreds() {
  try { localStorage.removeItem(CRED_KEY); } catch {}
  try { document.cookie = `${CRED_KEY}=; path=/; max-age=0; SameSite=Lax; Secure`; } catch {}
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ready = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // Don't unblock the app before the initial auto sign-in attempt has run,
      // otherwise guarded routes bounce to the login page for a moment.
      if (ready || s) setLoading(false);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session);
      } else {
        // No session (e.g. mobile browser cleared storage) — sign back in silently.
        try { await tryAutoSignIn(); } catch {}
      }
      ready = true;
      setLoading(false);
    });

    // Coming back to the app on mobile: restore the session if it went away.
    const onVisible = async () => {
      if (document.hidden) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) { try { await tryAutoSignIn(); } catch {} }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);


  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          clearAutoCreds();
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
