import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { NotionKanban } from "@/components/notion-kanban";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Notion-kanban i din kalender" },
      { name: "description", content: "Dina Notion-tasks som kanban-tavla: dra mellan statuskolumner, se deadlines och prioritet, synkat direkt mot Notion." },
      { property: "og:title", content: "Tasks — Notion-kanban i din kalender" },
      { property: "og:description", content: "Dina Notion-tasks som kanban-tavla: dra mellan statuskolumner, se deadlines och prioritet, synkat direkt mot Notion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Från Notion — dra kort mellan kolumnerna, ändringen skrivs tillbaka direkt.
          </p>
        </div>
        <NotionKanban />
      </div>
    </AppShell>
  );
}
