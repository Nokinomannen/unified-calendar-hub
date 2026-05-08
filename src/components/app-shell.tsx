import { Link, useRouter } from "@tanstack/react-router";
import { CalendarDays, Home, Layers, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssistantPanel } from "@/components/assistant-panel";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  if (!user) return <>{children}</>;

  const items = [
    { to: "/", label: "Today", icon: Home },
    { to: "/calendar", label: "Calendar", icon: CalendarDays },
    { to: "/sources", label: "Sources", icon: Layers },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <CalendarDays className="h-4 w-4" />
            </span>
            <span>One</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "rounded-md px-3 py-1.5 text-sm bg-accent text-foreground font-medium" }}
              >
                {it.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={async () => { await signOut(); router.navigate({ to: "/auth" }); }}>
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24">{children}</main>

      {/* mobile nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-2 py-2">
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground"
              activeProps={{ className: "flex flex-1 flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-xs text-primary font-medium" }}
            >
              <it.icon className="h-5 w-5" />
              {it.label}
            </Link>
          ))}
        </div>
      </nav>

      <AssistantPanel />
    </div>
  );
}

export function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 md:bottom-8 md:right-8",
      )}
      aria-label="Add event"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
