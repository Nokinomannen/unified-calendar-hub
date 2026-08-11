import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CalendarDays, Layers, LogOut, Plus, Sun, Moon, Monitor, Minus, BarChart3 } from "lucide-react";
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
import { CommandPalette } from "@/components/command-palette";
import { useActiveTimer, usePauseTimer, useResumeTimer, timerNetMs } from "@/hooks/use-timer";
import { useCalendars } from "@/hooks/use-calendar-data";
import { formatElapsed, useNowTick } from "@/components/timer-widget";
import { Pause, Play } from "lucide-react";

function HeaderTimer() {
  const { data: timer } = useActiveTimer();
  const { data: calendars = [] } = useCalendars();
  const pause = usePauseTimer();
  const resume = useResumeTimer();
  const now = useNowTick(!!timer);
  if (!timer) return null;
  const cal = calendars.find((c) => c.id === timer.calendar_id);
  const paused = !!timer.paused_at;
  return (
    <div className="mr-1 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/60 py-1 pl-2 pr-1 text-xs font-medium">
      <Link to="/" className="inline-flex items-center gap-1.5" title={`Timer ${paused ? "pausad" : "igång"} · ${cal?.name ?? "Jobb"}`}>
        <span
          className={cn("h-1.5 w-1.5 rounded-full", !paused && "animate-pulse")}
          style={{ background: paused ? "hsl(var(--muted-foreground))" : cal?.color ?? "hsl(var(--primary))" }}
        />
        <span className={cn("font-mono tabular-nums", paused && "text-muted-foreground")}>
          {formatElapsed(timerNetMs(timer, now))}
        </span>
      </Link>
      <button
        onClick={() => (paused ? resume.mutate(timer) : pause.mutate(timer))}
        className="grid h-5 w-5 place-items-center rounded-full hover:bg-accent"
        aria-label={paused ? "Fortsätt timern" : "Pausa timern"}
      >
        {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      </button>
    </div>
  );
}



export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!user) return <>{children}</>;

  const items = [
    { to: "/", label: "Calendar", icon: CalendarDays },
    { to: "/dashboard", label: "Insights", icon: BarChart3 },
    { to: "/sources", label: "Sources", icon: Layers },
    { to: "/settings", label: "Settings", icon: SlidersHorizontal },
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
            <HeaderTimer />
            <ZoomControls />

            <ThemeToggle />
            <Button size="sm" variant="ghost" onClick={async () => { await signOut(); router.navigate({ to: "/auth" }); }}>
              <LogOut className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-4 sm:py-6">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </main>

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
      <CommandPalette />
    </div>
  );
}

export function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-20 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background md:bottom-8 md:right-8",
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
