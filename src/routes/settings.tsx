import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { CalendarSettings, SettingToggle } from "@/components/calendar-settings";
import { CalendarColorSettings } from "@/components/calendar-colors";
import { ReminderSettings } from "@/components/reminder-settings";
import { RecentlyDeleted } from "@/components/recently-deleted";
import { ExportHoursDialog } from "@/components/export-hours";
import { BackupExport } from "@/components/backup-export";
import { useSettings, useUpdateSettings, type ViewMode } from "@/hooks/use-settings";
import { useActiveCalendars } from "@/hooks/use-calendar-data";
import { useTheme } from "@/hooks/use-theme";
import { useUiZoom } from "@/hooks/use-ui-zoom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Download, Keyboard, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Inställningar — One" },
      { name: "description", content: "Anpassa kalendervy, snabbinmatning, påminnelser och ekonomi i One." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Inställningar — One" },
      { property: "og:description", content: "Anpassa kalendervy, snabbinmatning, påminnelser och ekonomi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [user, loading, router]);

  const { settings } = useSettings();
  const update = useUpdateSettings();
  const set = <K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) => update.mutate({ [k]: v } as never);
  const { data: calendars = [] } = useActiveCalendars();
  const { theme, setTheme } = useTheme();
  const { zoom, zoomIn, zoomOut, reset } = useUiZoom();
  const [exportOpen, setExportOpen] = useState(false);

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Inställningar</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Gör kalendern till din</h1>
        </div>

        <Section title="Snabbrad" description="Raden överst i kalendern där du skriver in event i klartext.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 font-medium">Standardkalender</div>
              <Select
                value={settings.quickAddCalendarId ?? "auto"}
                onValueChange={(v) => set("quickAddCalendarId", v === "auto" ? null : v)}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatiskt</SelectItem>
                  {calendars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 font-medium">Standardlängd</div>
              <Select value={String(settings.quickAddMinutes)} onValueChange={(v) => set("quickAddMinutes", Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90, 120].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 font-medium">Avrunda starttid</div>
              <Select value={String(settings.quickAddRoundTo)} onValueChange={(v) => set("quickAddRoundTo", Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 30, 60].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <SettingToggle
              label="Visa snabbraden"
              description="Stäng av om du hellre använder plus-knappen."
              checked={settings.showQuickAdd}
              onChange={(v) => set("showQuickAdd", v)}
            />
          </div>
        </Section>

        <Section title="Kalendervy">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 font-medium">Standardvy</div>
              <Select value={settings.defaultView} onValueChange={(v) => set("defaultView", v as ViewMode)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Månad</SelectItem>
                  <SelectItem value="week">Vecka</SelectItem>
                  <SelectItem value="day">Dag</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 font-medium">Veckan börjar på</div>
              <Select value={String(settings.weekStartsOn)} onValueChange={(v) => set("weekStartsOn", Number(v) as 0 | 1)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Måndag</SelectItem>
                  <SelectItem value="0">Söndag</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <SettingToggle label="Visa väder" checked={settings.showWeather} onChange={(v) => set("showWeather", v)} />
            <SettingToggle label="Varna för krockar" checked={settings.showConflicts} onChange={(v) => set("showConflicts", v)} />
            <SettingToggle label="Visa timpanelen" checked={settings.showHours} onChange={(v) => set("showHours", v)} />
            <SettingToggle label="Visa kommande-listan" checked={settings.showUpcoming} onChange={(v) => set("showUpcoming", v)} />
          </div>
        </Section>

        <Section title="Utseende">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 font-medium">Tema</div>
              <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Ljust</SelectItem>
                  <SelectItem value="dark">Mörkt</SelectItem>
                  <SelectItem value="system">Följ systemet</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 font-medium">Täthet</div>
              <Select value={settings.density} onValueChange={(v) => set("density", v as "comfortable" | "compact")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">Luftig</SelectItem>
                  <SelectItem value="compact">Kompakt</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 font-medium">Zoom</div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={zoomOut}><Minus className="h-4 w-4" /></Button>
                <span className="min-w-[4ch] text-center tabular-nums">{Math.round(zoom * 100)}%</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={zoomIn}><Plus className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={reset}>Återställ</Button>
              </div>
            </div>
          </div>
        </Section>

        <CalendarSettings />
        <CalendarColorSettings />

        <Section title="Tid & pengar">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 font-medium">Skattesats för uppskattning (%)</div>
              <Input
                className="h-9"
                inputMode="decimal"
                defaultValue={String(settings.taxRate)}
                onBlur={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  if (!Number.isNaN(n)) set("taxRate", Math.min(70, Math.max(0, n)));
                }}
              />
            </label>
            <label className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="mb-1.5 font-medium">Målsatta timmar per vecka</div>
              <Input
                className="h-9"
                inputMode="decimal"
                defaultValue={String(settings.weeklyHoursGoal)}
                onBlur={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  if (!Number.isNaN(n)) set("weeklyHoursGoal", Math.max(0, n));
                }}
              />
            </label>
            <SettingToggle
              label="Räkna DJ-arvoden i prognosen"
              checked={settings.includeDjInForecast}
              onChange={(v) => set("includeDjInForecast", v)}
            />
          </div>
        </Section>

        <ReminderSettings />

        <Section title="Data">
          <Button variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Exportera timmar (CSV)
          </Button>
          <BackupExport />
          <RecentlyDeleted />
        </Section>

        <Section title="Kortkommandon">
          <ul className="grid gap-1.5 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              ["⌘K", "Kommandopalett"],
              ["Q", "Fokusera snabbraden"],
              ["N", "Nytt event"],
              ["T", "Hoppa till idag"],
              ["1 / 2 / 3", "Månad / vecka / dag"],
              ["← / →", "Bakåt / framåt"],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center gap-2">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-foreground">{k}</kbd>
                <span>{v}</span>
              </li>
            ))}
            <li className="col-span-full flex items-center gap-2 pt-1 text-xs">
              <Keyboard className="h-3.5 w-3.5" /> Kortkommandon fungerar när du inte skriver i ett fält.
            </li>
          </ul>
        </Section>
      </div>

      <ExportHoursDialog open={exportOpen} onOpenChange={setExportOpen} />
    </AppShell>
  );
}
