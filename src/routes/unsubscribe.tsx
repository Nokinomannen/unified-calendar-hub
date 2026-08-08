import { useEffect, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? (search["token"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Unsubscribe · Unified Calendar Hub" },
      { name: "description", content: "Manage your reminder email preferences for Unified Calendar Hub." },
      { property: "og:title", content: "Unsubscribe · Unified Calendar Hub" },
      { property: "og:description", content: "Manage your reminder email preferences for Unified Calendar Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnsubscribePage,
});

type State = "checking" | "valid" | "invalid" | "submitting" | "done" | "error";

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<State>("checking");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return setState("invalid");
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || body?.valid === false) return setState("invalid");
        setEmail(body?.email ?? null);
        setState("valid");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function confirm() {
    setState("submitting");
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Email reminders</h1>

        {state === "checking" && <p className="mt-3 text-sm text-muted-foreground">Checking your link…</p>}

        {state === "invalid" && (
          <p className="mt-3 text-sm text-muted-foreground">
            This unsubscribe link is invalid or has already been used.
          </p>
        )}

        {(state === "valid" || state === "submitting") && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Stop sending reminder emails{email ? ` to ${email}` : ""}?
            </p>
            <button
              type="button"
              onClick={confirm}
              disabled={state === "submitting"}
              className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {state === "submitting" ? "Unsubscribing…" : "Confirm unsubscribe"}
            </button>
          </>
        )}

        {state === "done" && (
          <p className="mt-3 text-sm text-muted-foreground">
            You&apos;re unsubscribed. You will no longer receive reminder emails.
          </p>
        )}

        {state === "error" && (
          <p className="mt-3 text-sm text-destructive">Something went wrong. Please try again later.</p>
        )}
      </div>
    </main>
  );
}
