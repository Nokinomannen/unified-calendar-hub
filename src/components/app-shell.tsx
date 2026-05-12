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
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
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

function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();
  const Icon = resolved === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="Toggle theme">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")} className={theme === "light" ? "bg-accent" : ""}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className={theme === "dark" ? "bg-accent" : ""}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className={theme === "system" ? "bg-accent" : ""}>
          <Monitor className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ZoomControls() {
  const { zoom, zoomIn, zoomOut, reset } = useUiZoom();
  return (
    <div className="hidden items-center gap-0.5 rounded-md border border-border/60 px-0.5 md:flex">
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={zoomOut} aria-label="Zoom out">
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <button
        onClick={reset}
        className="min-w-[3ch] px-1 text-xs tabular-nums text-muted-foreground hover:text-foreground"
        title="Reset zoom (Ctrl/Cmd+0)"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={zoomIn} aria-label="Zoom in">
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
