import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, X, Send, Sparkles, Loader2, Paperclip, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
type Attachment = { name: string; mime: string; base64: string; url: string };

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! Tell me what's booked and I'll add it. Try: *\"Dentist next Thursday at 14:30 for an hour\"* or attach a weekly screenshot and say *\"fix my school times from this\"*." },
  ]);
  const [convo, setConvo] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const ACCEPTED = /^image\/(png|jpe?g|webp|heic|heif)$/i;
  const isAcceptedImage = (f: File) =>
    ACCEPTED.test(f.type) || /\.(png|jpe?g|webp|heic|heif)$/i.test(f.name);

  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const accepted = arr.filter(isAcceptedImage);
    const rejected = arr.length - accepted.length;
    if (rejected > 0) {
      toast.error(`${rejected} file${rejected > 1 ? "s" : ""} skipped — only PNG, JPG, WEBP, HEIC images are accepted`);
    }
    const next: Attachment[] = [];
    for (const file of accepted) {
      const b64: string = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.readAsDataURL(file);
      });
      next.push({ name: file.name || "pasted-image", mime: file.type || "image/png", base64: b64, url: URL.createObjectURL(file) });
    }
    if (next.length) setAttachments((a) => [...a, ...next]);
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  }

  function onDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  }
  function onDragOver(e: React.DragEvent) {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function onDragLeave(e: React.DragEvent) {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length) addFiles(files);
  }

  async function send() {
    const text = input.trim();
    if ((!text && !attachments.length) || busy) return;
    const display = text || (attachments.length ? `[${attachments.length} screenshot(s) attached]` : "");
    const next = [...messages, { role: "user" as const, content: display }];
    setMessages(next);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);
    setBusy(true);
    try {
      const outgoing = [...convo.filter((m) => m.role !== "system"), { role: "user", content: display }];
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: {
          messages: outgoing,
          images: sentAttachments.map((a) => ({ base64: a.base64, mime: a.mime, name: a.name })),
        },
      });
      if (error) throw error;
      const d = data as { error?: string; reply?: string; convo?: any[] };
      if (d?.error) {
        toast.error(d.error);
        setMessages((m) => [...m, { role: "assistant", content: d.reply || d.error || "Sorry, that failed." }]);
        return;
      }
      const reply = d.reply || "(no reply)";
      setConvo((d.convo || []).filter((m: any) => m.role !== "system"));
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      qc.invalidateQueries({ queryKey: ["events"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assistant failed");
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, that failed. Try again?" }]);
    } finally {
      setBusy(false);
    }
  }

  function resetChat() {
    setMessages([
      { role: "assistant", content: "Hi! Tell me what's booked and I'll add it. Try: *\"Dentist next Thursday at 14:30 for an hour\"* or attach a weekly screenshot and say *\"fix my school times from this\"*." },
    ]);
    setConvo([]);
    setAttachments([]);
    setInput("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background md:bottom-8 md:left-8"
        aria-label="Open assistant"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-6">
          <div className="flex h-[80vh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-[var(--shadow-elegant)] md:h-[70vh] md:rounded-2xl">
            <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-[image:var(--gradient-primary)] text-primary-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <h2 className="font-semibold tracking-tight">Assistant</h2>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={resetChat} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Reset chat" title="Reset chat">
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]" : "bg-muted/60 text-foreground"}`}>
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 dark:prose-invert">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-muted/60 px-3.5 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">thinking…</span>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`relative border-t border-border p-3 ${dragOver ? "bg-primary/5" : ""}`}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {dragOver && (
                <div className="pointer-events-none absolute inset-1 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary">
                  Drop image to attach
                </div>
              )}
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((a, i) => (
                    <div key={i} className="relative">
                      <img src={a.url} alt={a.name} className="h-14 w-14 rounded border border-border object-cover" />
                      <button
                        onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))}
                        className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-destructive text-destructive-foreground"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                  multiple
                  className="hidden"
                  onChange={(e) => { const fs = e.target.files; if (fs && fs.length) addFiles(fs); e.target.value = ""; }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  aria-label="Attach screenshot"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  onPaste={onPaste}
                  placeholder="Tell me what's booked, drop/paste a screenshot, or ask a question…"
                  rows={2}
                  className="resize-none"
                  disabled={busy}
                />
                <Button onClick={send} disabled={busy || (!input.trim() && !attachments.length)} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Enter to send · Shift+Enter newline · 📎 drag, drop, or paste (⌘V) screenshots</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AssistantButton() {
  return (
    <button className="hidden">
      <MessageSquare />
    </button>
  );
}
