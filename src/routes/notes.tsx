import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Bold, Italic, Code, Copy, ShieldAlert, FileText } from "lucide-react";
import { useActiveTarget } from "@/contexts/ActiveTargetContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "@/components/Badges";
import { SEVERITIES } from "@/lib/owasp";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Notes — Kels.Ai" }] }),
  component: NotesPage,
});

type Note = { id: string; target_id: string | null; title: string | null; content: string | null; severity: string | null; updated_at: string; created_at: string };
type Target = { id: string; domain_url: string };

function NotesPage() {
  const { target, setTarget } = useActiveTarget();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [severity, setSeverity] = useState<string>("None");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("targets").select("id,domain_url").then(({ data }) => {
      const ts = (data as Target[]) ?? [];
      setTargets(ts);
      if (!target && ts[0]) setTarget(ts[0]);
    });
  }, []);

  async function loadNotes() {
    if (!target?.id) { setNotes([]); return; }
    const { data } = await supabase.from("notes").select("*").eq("target_id", target.id).order("updated_at", { ascending: false });
    setNotes((data as Note[]) ?? []);
  }

  useEffect(() => { loadNotes(); setActiveId(null); setContent(""); setSeverity("None"); }, [target?.id]);

  const active = notes?.find(n => n.id === activeId) ?? null;

  useEffect(() => {
    if (active) { setContent(active.content ?? ""); setSeverity(active.severity ?? "None"); }
  }, [activeId]);

  useEffect(() => {
    if (!active) return;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const title = (content.split(/\n/)[0] ?? "").slice(0, 80) || "Untitled";
      const { error } = await supabase.from("notes").update({ content, severity, title }).eq("id", active.id);
      if (!error) {
        setSaveState("saved");
        setNotes(cur => cur?.map(n => n.id === active.id ? { ...n, content, severity, title, updated_at: new Date().toISOString() } : n) ?? null);
      }
    }, 1000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [content, severity]);

  async function newNote() {
    if (!target?.id) { toast.error("Pick a target"); return; }
    const { data } = await supabase.from("notes").insert({ target_id: target.id, title: "Untitled", content: "", severity: "None" }).select().single();
    if (data) { setNotes(cur => [data as Note, ...(cur ?? [])]); setActiveId((data as Note).id); }
  }

  async function delNote(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("notes").delete().eq("id", id);
    setNotes(cur => cur?.filter(n => n.id !== id) ?? null);
    if (activeId === id) setActiveId(null);
  }

  function wrap(prefix: string, suffix = prefix) {
    const el = editorRef.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const before = content.slice(0, s), sel = content.slice(s, e), after = content.slice(e);
    setContent(`${before}${prefix}${sel}${suffix}${after}`);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = s + prefix.length; el.selectionEnd = e + prefix.length; });
  }

  function convertToVuln() {
    if (!active) return;
    sessionStorage.setItem("kelsai.vulnPrefill", JSON.stringify({
      title: active.title ?? "From notes", description: content, severity, target_id: active.target_id,
    }));
    navigate({ to: "/vulnerabilities" });
    toast.success("Open Vulnerability Tracker to finalize");
  }

  function copyBugcrowd() {
    const md = `**Title:** ${active?.title ?? "Note"}\n**Severity:** ${severity}\n\n**Details:**\n${content}\n`;
    navigator.clipboard.writeText(md);
    toast.success("Copied");
  }

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-glow-blue flex items-center gap-2"><FileText className="h-6 w-6 text-[color:var(--primary)]" /> Notes Workspace</h1>
        <p className="text-sm text-muted-foreground">Persistent target-linked notes</p>
      </header>

      <div className="glass p-3 flex items-center gap-2">
        <Select value={target?.id ?? ""} onValueChange={(id) => { const t = targets?.find(x => x.id === id); if (t) setTarget(t); }}>
          <SelectTrigger className="w-[320px] font-mono text-xs"><SelectValue placeholder="Select target" /></SelectTrigger>
          <SelectContent>{(targets ?? []).map(t => <SelectItem key={t.id} value={t.id}>{t.domain_url}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-[30%_1fr] gap-4 min-h-[60vh]">
        <aside className="glass p-3 space-y-2">
          <Button size="sm" className="w-full" onClick={newNote}><Plus className="h-3.5 w-3.5 mr-1" />New Note</Button>
          <div className="space-y-1.5 max-h-[65vh] overflow-y-auto">
            {notes === null && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            {notes && notes.length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">No notes yet</div>}
            {notes?.map(n => (
              <button
                key={n.id}
                onClick={() => setActiveId(n.id)}
                className={`w-full text-left rounded-md p-2 border transition-colors ${activeId === n.id ? "border-[color:var(--primary)]/50 bg-[color:var(--primary)]/10" : "border-[color:var(--glass-border)] bg-white/[0.02] hover:bg-white/[0.05]"}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="flex-1 truncate text-sm font-semibold">{n.title || "Untitled"}</span>
                  {n.severity && n.severity !== "None" && <SeverityBadge severity={n.severity as any} />}
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                  <span>{new Date(n.updated_at).toLocaleString()}</span>
                  <span onClick={(e) => { e.stopPropagation(); delNote(n.id); }} className="cursor-pointer hover:text-[color:var(--danger)]"><Trash2 className="h-3 w-3" /></span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="glass p-3 flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a note or create a new one</div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 mb-2">
                <Button size="sm" variant="ghost" onClick={() => wrap("**")}><Bold className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => wrap("_")}><Italic className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => wrap("\n```\n", "\n```\n")}><Code className="h-3.5 w-3.5" /></Button>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : ""}</span>
                  <Button size="sm" variant="secondary" onClick={convertToVuln}><ShieldAlert className="h-3.5 w-3.5 mr-1" />Convert</Button>
                  <Button size="sm" variant="secondary" onClick={copyBugcrowd}><Copy className="h-3.5 w-3.5 mr-1" />Bugcrowd</Button>
                </div>
              </div>
              <Textarea
                ref={editorRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your observations…"
                className="flex-1 font-mono text-xs bg-[#0a0a0f] min-h-[50vh] resize-none"
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}