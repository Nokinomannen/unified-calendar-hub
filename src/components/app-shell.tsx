import { Link, useRouter } from "@tanstack/react-router";
import { CalendarDays, Layers, LogOut, Plus, Sun, Moon, Monitor, Minus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useUiZoom } from "@/hooks/use-ui-zoom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AssistantPanel } from "@/components/assistant-panel";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  if (!user) return <>{children}</>;

  const items = [
    { to: "/", label: "Calendar", icon: CalendarDays },
    { to: "/sources", label: "Sources", icon: Layers },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
              <CalendarDays className="h-4 w-4" />
            </span>
            <span className="text-base tracking-tight">One</span>
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
          <div className="flex items-center gap-1">
            <ZoomControls />
            <ThemeToggle />
            <Button size="sm" variant="ghost" onClick={async () => { await signOut(); router.navigate({ to: "/auth" }); }}>
              <LogOut className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24">{children}</main>

      {/* mobile nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-xl md:hidden">
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
        "fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background md:bottom-8 md:right-8",
      )}
      aria-label="Add event"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
