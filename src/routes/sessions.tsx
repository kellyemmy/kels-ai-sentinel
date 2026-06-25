import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, Trash2, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/sessions")({
  head: () => ({ meta: [{ title: "Session Manager — Kels.Ai" }] }),
  component: SessionsPage,
});

type AuthType = "cookie" | "bearer" | "basic" | "custom";
type Target = { id: string; domain_url: string };
type AuthSession = {
  id: string;
  target_id: string | null;
  session_name: string;
  auth_type: AuthType;
  session_data: any;
  is_active: boolean;
  last_used: string | null;
  created_at: string;
};

function SessionsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [filterTarget, setFilterTarget] = useState<string>("all");
  const [testResult, setTestResult] = useState<Record<string, { code: number | string; tone: "ok"|"warn"|"err"|"muted" }>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form
  const [formTarget, setFormTarget] = useState<string>("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<AuthType>("cookie");
  const [data, setData] = useState({ cookie: "", token: "", username: "", password: "", header: "", value: "" });

  async function load() {
    const [tRes, sRes] = await Promise.all([
      supabase.from("targets").select("id, domain_url").order("created_at", { ascending: false }),
      supabase.from("auth_sessions").select("*").order("created_at", { ascending: false }),
    ]);
    setTargets((tRes.data ?? []) as Target[]);
    setSessions((sRes.data ?? []) as AuthSession[]);
    if (!formTarget && tRes.data?.[0]) setFormTarget(tRes.data[0].id);
  }

  useEffect(() => { load(); }, []);

  const targetMap = useMemo(() => Object.fromEntries(targets.map(t => [t.id, t.domain_url])), [targets]);

  const filtered = sessions.filter(s => filterTarget === "all" || s.target_id === filterTarget);

  async function save() {
    if (!formTarget) { toast.error("Pick a target"); return; }
    if (!formName.trim()) { toast.error("Session name is required"); return; }
    const payload: any = {};
    if (formType === "cookie") payload.cookie = data.cookie;
    if (formType === "bearer") payload.token = data.token;
    if (formType === "basic") { payload.username = data.username; payload.password = data.password; }
    if (formType === "custom") { payload.header = data.header; payload.value = data.value; }
    const { error } = await supabase.from("auth_sessions").insert({
      target_id: formTarget, session_name: formName.trim(), auth_type: formType, session_data: payload,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Session saved");
    setFormName(""); setData({ cookie: "", token: "", username: "", password: "", header: "", value: "" });
    load();
  }

  async function setActive(s: AuthSession) {
    if (!s.target_id) return;
    await supabase.from("auth_sessions").update({ is_active: false }).eq("target_id", s.target_id);
    await supabase.from("auth_sessions").update({ is_active: true, last_used: new Date().toISOString() }).eq("id", s.id);
    toast.success("Session marked active");
    load();
  }

  async function testSession(s: AuthSession) {
    if (!s.target_id) return;
    const url = targetMap[s.target_id];
    if (!url) return;
    setTestResult(p => ({ ...p, [s.id]: { code: "…", tone: "muted" } }));
    try {
      const headers: Record<string, string> = {};
      if (s.auth_type === "cookie") headers["Cookie"] = s.session_data?.cookie ?? "";
      if (s.auth_type === "bearer") headers["Authorization"] = `Bearer ${s.session_data?.token ?? ""}`;
      if (s.auth_type === "basic") headers["Authorization"] = `Basic ${btoa(`${s.session_data?.username ?? ""}:${s.session_data?.password ?? ""}`)}`;
      if (s.auth_type === "custom") headers[s.session_data?.header ?? "X-Auth"] = s.session_data?.value ?? "";
      const r = await fetch(url, { headers, mode: "cors" });
      const tone = r.status < 300 ? "ok" : r.status === 401 ? "err" : r.status === 403 ? "warn" : "muted";
      setTestResult(p => ({ ...p, [s.id]: { code: r.status, tone } }));
    } catch {
      setTestResult(p => ({ ...p, [s.id]: { code: "ERR", tone: "err" } }));
    }
  }

  async function remove(id: string) {
    await supabase.from("auth_sessions").delete().eq("id", id);
    setConfirmDelete(null);
    toast("Session deleted");
    load();
  }

  const toneCls: Record<string, string> = {
    ok: "bg-[color:var(--success)]/20 text-[color:var(--success)] border-[color:var(--success)]/40",
    warn: "bg-[color:var(--gold)]/20 text-[color:var(--gold)] border-[color:var(--gold)]/40",
    err: "bg-[color:var(--danger)]/20 text-[color:var(--danger)] border-[color:var(--danger)]/40",
    muted: "bg-white/[0.05] text-muted-foreground border-[color:var(--glass-border)]",
  };

  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-glow-blue">Session Manager</h1>
        <p className="text-sm text-muted-foreground">Authenticated scanning sessions per target</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* LEFT — Add */}
        <section className="glass p-5 lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" /> Add Authentication Session</h2>

          <div className="space-y-1.5">
            <Label>Target</Label>
            <Select value={formTarget} onValueChange={setFormTarget}>
              <SelectTrigger><SelectValue placeholder="Pick a target" /></SelectTrigger>
              <SelectContent>{targets.map(t => <SelectItem key={t.id} value={t.id}>{t.domain_url}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Session Name</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Admin User" />
          </div>

          <div className="space-y-1.5">
            <Label>Auth Type</Label>
            <div className="grid grid-cols-4 gap-1 rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] p-1">
              {(["cookie","bearer","basic","custom"] as AuthType[]).map(t => (
                <button key={t} onClick={() => setFormType(t)}
                  className={cn("rounded px-2 py-1 text-[11px] uppercase tracking-wider transition-colors",
                    formType === t ? "bg-[color:var(--primary)] text-white" : "text-muted-foreground hover:bg-white/5")}>
                  {t === "cookie" ? "Cookie" : t === "bearer" ? "Bearer" : t === "basic" ? "Basic" : "Custom"}
                </button>
              ))}
            </div>
          </div>

          {formType === "cookie" && (
            <div className="space-y-1.5">
              <Label>Cookie String</Label>
              <Textarea value={data.cookie} onChange={(e) => setData({ ...data, cookie: e.target.value })}
                placeholder="session=abc123; csrf_token=xyz; ..." rows={5} className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground">Copy from browser DevTools → Network tab → Request Headers → Cookie</p>
            </div>
          )}
          {formType === "bearer" && (
            <div className="space-y-1.5">
              <Label>Bearer Token</Label>
              <Input value={data.token} onChange={(e) => setData({ ...data, token: e.target.value })} placeholder="eyJhbGc..." className="font-mono text-xs" />
            </div>
          )}
          {formType === "basic" && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Username</Label><Input value={data.username} onChange={(e) => setData({ ...data, username: e.target.value })} /></div>
              <div><Label>Password</Label><Input type="password" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} /></div>
            </div>
          )}
          {formType === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Header Name</Label><Input value={data.header} onChange={(e) => setData({ ...data, header: e.target.value })} placeholder="X-Auth-Token" /></div>
              <div><Label>Header Value</Label><Input value={data.value} onChange={(e) => setData({ ...data, value: e.target.value })} /></div>
            </div>
          )}

          <Button onClick={save} className="w-full bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90">Save Session</Button>

          <div className="rounded-md border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 p-3 flex items-start gap-2 text-[11px] text-amber-200">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Sessions are encrypted and stored per target. The agent uses the active session for authenticated endpoint testing.</span>
          </div>
        </section>

        {/* RIGHT — List */}
        <section className="glass p-5 lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Saved Sessions</h2>
            <Select value={filterTarget} onValueChange={setFilterTarget}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All targets</SelectItem>
                {targets.map(t => <SelectItem key={t.id} value={t.id}>{t.domain_url}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <EmptyState icon={KeyRound} title="No sessions saved" body="Add a session to enable authenticated scanning." />
            )}
            {filtered.map(s => {
              const result = testResult[s.id];
              return (
                <div key={s.id} className={cn(
                  "rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] p-3 space-y-2",
                  s.is_active && "border-l-2 border-l-[color:var(--success)] bg-[color:var(--success)]/[0.05]"
                )}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{s.session_name}</span>
                    <span className="text-[10px] uppercase rounded bg-white/5 px-1.5 py-0.5">{s.auth_type}</span>
                    {s.is_active && (
                      <span className="text-[10px] uppercase rounded bg-[color:var(--success)]/20 text-[color:var(--success)] px-1.5 py-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />Active
                      </span>
                    )}
                    {result && (
                      <span className={cn("ml-auto text-[10px] rounded border px-1.5 py-0.5 font-mono", toneCls[result.tone])}>
                        {result.code}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">{s.target_id ? targetMap[s.target_id] ?? "—" : "—"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Created {new Date(s.created_at).toLocaleString()} · Last used {s.last_used ? new Date(s.last_used).toLocaleString() : "Never"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!s.is_active && <Button size="sm" variant="secondary" onClick={() => setActive(s)}>Set Active</Button>}
                    <Button size="sm" variant="ghost" onClick={() => testSession(s)}>Test</Button>
                    {confirmDelete === s.id ? (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => remove(s.id)}>Confirm Delete</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(s.id)} className="ml-auto text-[color:var(--danger)]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}