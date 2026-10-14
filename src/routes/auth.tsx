import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveAutoCreds, tryAutoSignIn } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const go = () => {
      const target = oauthReturnPath(next);
      if (target !== "/") router.history.push(target);
      else router.navigate({ to: "/" });
    };
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) { go(); return; }
      // Remembered login (mobile browsers often drop the session) — sign in silently.
      try { if (await tryAutoSignIn()) go(); } catch {}
    });
  }, [router, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Private app — sign-in only. No public sign-up.
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      saveAutoCreds(email, password);
      const target = oauthReturnPath(next);
      if (target !== "/") router.history.push(target);
      else router.navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-background to-accent/30 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-semibold">One Calendar</h1>
          <p className="text-sm text-muted-foreground">Privat kalender — logga in för att fortsätta.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button className="w-full" disabled={loading}>{loading ? "…" : "Sign in"}</Button>
        </form>

      </div>
    </div>
  );
}
