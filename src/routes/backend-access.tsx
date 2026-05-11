import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/backend-access")({
  component: BackendAccessPage,
  head: () => ({
    meta: [
      { title: "Access your backend settings" },
      { name: "description", content: "Step-by-step guide to find and access your backend (Lovable Cloud) project settings from the editor." },
    ],
  }),
});

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
        {n}
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <div className="text-sm text-muted-foreground space-y-2">{children}</div>
      </div>
    </div>
  );
}

function BackendAccessPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-10 space-y-8">
      <header className="space-y-2">
        <Badge variant="secondary">Guide</Badge>
        <h1 className="text-3xl font-bold tracking-tight">Access your backend settings</h1>
        <p className="text-muted-foreground">
          This app's backend runs on Lovable Cloud. You don't need a separate Supabase account — everything is managed
          inside the Lovable editor. Follow the steps below to find your database, auth, storage, secrets, and edge
          functions.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Desktop</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Step n={1} title="Open the Cloud view">
            <p>In the top navigation bar above the preview, click the <strong>Cloud</strong> icon. If you don't see it, click the <strong>+ More</strong> menu and pick Cloud.</p>
            <p>Shortcut: press <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd> (Mac) or <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">Ctrl K</kbd> (Windows/Linux), then type "Cloud".</p>
          </Step>
          <Step n={2} title="Pick a section">
            <p>The Cloud view contains: <strong>Overview</strong>, <strong>Database</strong> (tables + RLS), <strong>Users</strong> (auth settings), <strong>Storage</strong>, <strong>Emails</strong>, <strong>Edge Functions</strong>, <strong>Secrets</strong>, and <strong>AI</strong>.</p>
          </Step>
          <Step n={3} title="Auth settings">
            <p>Cloud → <strong>Users</strong> → click the gear labeled <strong>Auth settings</strong> to manage sign-in methods, sign-up rules, email/phone, and Google/Apple OAuth.</p>
          </Step>
          <Step n={4} title="Database & RLS">
            <p>Cloud → <strong>Database</strong> for tables and <strong>RLS Policies</strong>. Use the export button on a table to download data as CSV.</p>
          </Step>
          <Step n={5} title="Project settings">
            <p>Click the project name (top left) → <strong>Settings</strong>, or use <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">⌘.</kbd> / <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">Ctrl .</kbd>.</p>
          </Step>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mobile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Step n={1} title="Switch to Chat mode">
            <p>You can only reach the editor menus from Chat mode.</p>
          </Step>
          <Step n={2} title="Open the tools menu">
            <p>Tap the <strong>…</strong> (ellipsis) icon in the bottom-right → <strong>Cloud</strong>.</p>
          </Step>
          <Step n={3} title="Navigate sub-pages">
            <p>Use the horizontal tab row to switch between Overview, Database, Users, Storage, Emails, Edge Functions, Secrets, and AI.</p>
          </Step>
          <Step n={4} title="Project settings">
            <p>Tap the <strong>…</strong> menu → <strong>Settings</strong>, or tap the project name at the top → <strong>Settings</strong>.</p>
          </Step>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Good to know</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Lovable Cloud is the managed backend for this project. There is no separate external dashboard to log into — all configuration lives in the Cloud view.</p>
          <p>Secrets (API keys, tokens) live under Cloud → <strong>Secrets</strong> and are only available to edge functions, never the browser bundle.</p>
        </CardContent>
      </Card>

      <div className="text-sm">
        <Link to="/" className="text-primary hover:underline">← Back to calendar</Link>
      </div>
    </main>
  );
}
