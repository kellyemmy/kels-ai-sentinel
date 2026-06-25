import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Rocket, Cpu, Eye, EyeOff, ChevronDown, ChevronRight, XOctagon, RotateCcw, Trash2, Radar, ServerCrash, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AGENT_PHASES } from "@/lib/owasp";
import { TargetStatusBadge, AgentBadge } from "@/components/Badges";
import {
  loadAgentConfig, saveAgentConfig, DEFAULT_AGENT_CONFIG, loadForm, saveForm,
  type AgentConfig,
} from "@/lib/agent-config";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionManager } from "@/components/SessionManager";
import { KeyRound, Crosshair, Link as LinkIcon } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { onEngineStatus, getEngineStatus, pingEngine, type EngineStatus } from "@/lib/engine-status";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/targets")({
  head: () => ({ meta: [{ title: "Target Manager — Kels.Ai" }] }),
  component: TargetManager,
});

type Target = { id: string; domain_url: string; status: string; testing_profile: string | null; created_at: string };
type AgentLog = { id: string; agent_name: string | null; log_message: string | null; timestamp: string; target_id: string | null };

const PROFILES = ["Passive Recon Only", "Active OWASP Scan", "API Deep-Dive", "Full Autonomous (all phases)"];

type FormState = {
  domain: string;
  profile: string;
  followSubdomains: boolean;
  testAuthEndpoints: boolean;
  aggressiveFuzz: boolean;
};

const DEFAULT_FORM: FormState = {
  domain: "",
  profile: PROFILES[1],
  followSubdomains: true,
  testAuthEndpoints: false,
  aggressiveFuzz: false,
};

function TargetManager() {
  const [form, setForm] = useState<FormState>(() => loadForm("kelsai.target.form", DEFAULT_FORM));
  const [errors, setErrors] = useState<{ domain?: string }>({});
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG);
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [health, setHealth] = useState<"unknown" | "ok" | "fail">("unknown");
  const [tracking, setTracking] = useState<{ targetId: string; startedAt: number; phaseIdx: number } | null>(null);
  const [liveLogs, setLiveLogs] = useState<AgentLog[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [scanState, setScanState] = useState<"running" | "aborted" | "completed">("running");
  const [summary, setSummary] = useState<{ critical: number; high: number; medium: number; low: number } | null>(null);
  const [engine, setEngine] = useState<EngineStatus>(getEngineStatus());
  const [showOfflineCard, setShowOfflineCard] = useState(false);
  const [now, setNow] = useState(Date.now());
  const phaseTimer = useRef<number | null>(null);

  useEffect(() => { setConfig(loadAgentConfig()); }, []);
  useEffect(() => { saveForm("kelsai.target.form", form); }, [form]);
  useEffect(() => onEngineStatus(setEngine), []);

  // FAB quick-add focus
  useEffect(() => {
    if (sessionStorage.getItem("kelsai.targets.autofocus") === "1") {
      sessionStorage.removeItem("kelsai.targets.autofocus");
      setTimeout(() => document.querySelector<HTMLInputElement>('input[placeholder^="https://"]')?.focus(), 50);
    }
  }, []);

  // tick every 60s so stuck-scan UI re-evaluates
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(i);
  }, []);

  async function loadTargets() {
    const { data } = await supabase.from("targets").select("*").order("created_at", { ascending: false });
    setTargets((data ?? []) as Target[]);
  }
  useEffect(() => {
    loadTargets();
    const ch = supabase.channel("targets-list").on(
      "postgres_changes", { event: "*", schema: "public", table: "targets" }, () => loadTargets()
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Elapsed timer + simulated phase progression while tracking
  useEffect(() => {
    if (!tracking || scanState !== "running") return;
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - tracking.startedAt) / 1000)), 1000);
    phaseTimer.current = window.setInterval(() => {
      setTracking((cur) => cur ? { ...cur, phaseIdx: Math.min(cur.phaseIdx + 1, AGENT_PHASES.length - 1) } : cur);
    }, 6000) as unknown as number;
    return () => {
      window.clearInterval(t);
      if (phaseTimer.current) window.clearInterval(phaseTimer.current);
    };
  }, [tracking?.targetId, scanState]);

  // Watch tracked target row for status → completed/error → end scan
  useEffect(() => {
    if (!tracking) return;
    const ch = supabase.channel(`tt-${tracking.targetId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "targets", filter: `id=eq.${tracking.targetId}` },
        async (p: any) => {
          const st = p.new?.status;
          if (st === "completed") {
            setScanState("completed");
            setTracking((cur) => cur ? { ...cur, phaseIdx: AGENT_PHASES.length - 1 } : cur);
            const { data } = await supabase.from("vulnerabilities").select("severity").eq("target_id", tracking.targetId);
            const sev = (data ?? []).reduce((acc, v) => { const k = (v.severity ?? "Low").toLowerCase(); (acc as any)[k] = ((acc as any)[k] ?? 0) + 1; return acc; }, { critical: 0, high: 0, medium: 0, low: 0 });
            setSummary(sev as any);
          } else if (st === "error") {
            setScanState("aborted");
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tracking?.targetId]);

  // Subscribe to logs for current tracked target
  useEffect(() => {
    if (!tracking) return;
    setLiveLogs([]);
    supabase
      .from("agent_logs")
      .select("*")
      .eq("target_id", tracking.targetId)
      .order("timestamp", { ascending: true })
      .then(({ data }) => setLiveLogs((data ?? []) as AgentLog[]));
    const ch = supabase
      .channel(`logs-${tracking.targetId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_logs", filter: `target_id=eq.${tracking.targetId}` },
        (p) => setLiveLogs((cur) => [...cur, p.new as AgentLog]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tracking?.targetId]);

  async function checkHealth() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(`${config.backendUrl.replace(/\/$/, "")}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      setHealth(res.ok ? "ok" : "fail");
    } catch {
      setHealth("fail");
    }
  }

  async function launch() {
    const errs: typeof errors = {};
    if (!form.domain.trim()) errs.domain = "Required";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (getEngineStatus() === "offline") {
      setShowOfflineCard(true);
      toast.error("Agent engine is offline — start the backend first");
      return;
    }
    const { data, error } = await supabase
      .from("targets")
      .insert({ domain_url: form.domain.trim(), status: "scanning", testing_profile: form.profile })
      .select("*")
      .single();
    if (error || !data) { toast.error("Could not create target"); return; }
    toast.info("Scan launched successfully", { description: data.domain_url });

    // Fire-and-forget POST to agent backend
    fetch(config.backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_url: form.domain.trim(),
        profile: form.profile,
        options: {
          follow_subdomains: form.followSubdomains,
          test_authenticated_endpoints: form.testAuthEndpoints,
          aggressive_fuzzing: form.aggressiveFuzz,
          max_concurrent: config.maxConcurrent,
          request_delay_ms: config.requestDelayMs,
          scan_timeout_min: config.scanTimeoutMin,
        },
        supabase_target_id: data.id,
        api_key: config.apiKey,
      }),
    }).catch(() => toast.error("Agent connection failed"));

    setTracking({ targetId: data.id, startedAt: Date.now(), phaseIdx: 0 });
    setElapsed(0);
    setScanState("running");
    setSummary(null);
    setShowOfflineCard(false);
  }

  async function abortScan() {
    if (!tracking) return;
    fetch(`${config.backendUrl.replace(/\/$/, "")}/agent/${tracking.targetId}`, { method: "DELETE" }).catch(() => {});
    await supabase.from("targets").update({ status: "idle" }).eq("id", tracking.targetId);
    toast("Scan aborted");
    setScanState("aborted");
  }

  // ---- Stuck-scan helpers ----
  const THIRTY_MIN = 30 * 60 * 1000;
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  function ageMs(t: Target) { return now - +new Date(t.created_at); }
  function effectiveStatus(t: Target): string {
    if (t.status === "scanning" && ageMs(t) > TWO_HOURS) return "error";
    return t.status;
  }
  function isStuck(t: Target) { return t.status === "scanning" && ageMs(t) > THIRTY_MIN; }

  async function resetOne(id: string) {
    await supabase.from("targets").update({ status: "error" }).eq("id", id);
    toast.success("Status reset to error");
  }
  async function clearAllStuck() {
    const stuck = (targets ?? []).filter(isStuck);
    if (stuck.length === 0) { toast("No stuck scans"); return; }
    await supabase.from("targets").update({ status: "error" }).in("id", stuck.map(t => t.id));
    toast.success(`Reset ${stuck.length} stuck scan${stuck.length === 1 ? "" : "s"}`);
  }
  const stuckCount = (targets ?? []).filter(isStuck).length;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-glow-blue">Target Manager</h1>
        <p className="text-sm text-muted-foreground">Configure and launch autonomous penetration agents</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT — New Target */}
        <section className="glass p-5 lg:col-span-3 space-y-5">
          <h2 className="font-semibold">New Target</h2>

          <div className="space-y-1.5">
            <Label>Root Domain</Label>
            <Input
              placeholder="https://target.com"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              className="font-mono"
            />
            {errors.domain && <p className="text-xs text-[color:var(--danger)]">{errors.domain}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Testing Profile</Label>
            <Select value={form.profile} onValueChange={(v) => setForm({ ...form, profile: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROFILES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ToggleRow label="Follow Subdomains" checked={form.followSubdomains} onChange={(v) => setForm({ ...form, followSubdomains: v })} />
            <ToggleRow label="Test Authenticated Endpoints" checked={form.testAuthEndpoints} onChange={(v) => setForm({ ...form, testAuthEndpoints: v })} />
            <ToggleRow label="Aggressive Fuzzing Mode" checked={form.aggressiveFuzz} onChange={(v) => setForm({ ...form, aggressiveFuzz: v })} />
          </div>

          <Button
            onClick={launch}
            className="w-full bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90 text-white h-11 hover:glow-blue transition-shadow"
          >
            <Rocket className="mr-2 h-4 w-4" /> Launch Autonomous Agent
          </Button>

          <div className="flex justify-end">
            <SessionManager
              trigger={
                <Button variant="ghost" size="sm">
                  <KeyRound className="h-3.5 w-3.5 mr-1" /> Sessions
                </Button>
              }
            />
          </div>

          {/* Phase strip */}
          <PhaseStrip phaseIdx={tracking?.phaseIdx ?? -1} />

          {/* Past targets list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Past Targets</h3>
              {stuckCount > 0 && (
                <Button size="sm" variant="ghost" onClick={clearAllStuck} className="text-[color:var(--danger)] h-7">
                  <Trash2 className="h-3 w-3 mr-1" /> Clear All Stuck ({stuckCount})
                </Button>
              )}
            </div>
            <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
              {targets === null && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              {targets && targets.length === 0 && (
                <EmptyState
                  icon={Crosshair}
                  title="No targets added yet"
                  body="Add your first target using the form above to begin autonomous scanning."
                />
              )}
              {targets?.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm">{t.domain_url}</div>
                    <div className="text-[11px] text-muted-foreground">{t.testing_profile} · {new Date(t.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isStuck(t) && (
                      <Button size="sm" variant="ghost" onClick={() => resetOne(t.id)} className="h-6 px-2 text-[10px] text-[color:var(--danger)]">
                        <RotateCcw className="h-3 w-3 mr-1" /> Reset
                      </Button>
                    )}
                    <TargetStatusBadge status={effectiveStatus(t)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT — AI Control Center / Live Tracking */}
        <section className="glass p-5 lg:col-span-2 space-y-4">
          {showOfflineCard && engine === "offline" && (
            <EngineOfflineCard onRetry={async () => {
              await pingEngine(config.backendUrl);
              if (getEngineStatus() === "online") setShowOfflineCard(false);
            }} />
          )}
          {!tracking ? (
            <>
              <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-[color:var(--primary)]" /><h2 className="font-semibold">AI Control Center</h2></div>
              <div className="space-y-1.5">
                <Label>Agent Backend URL</Label>
                <Input value={config.backendUrl} onChange={(e) => setConfig({ ...config, backendUrl: e.target.value })} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>API Key</Label>
                <div className="relative">
                  <Input type={showKey ? "text" : "password"} value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} className="font-mono pr-9" />
                  <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">AI Model:</span>
                <span className="inline-flex items-center rounded-full border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/15 px-2 py-0.5 text-[11px] text-[color:var(--primary)]">
                  Claude (Anthropic)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => { saveAgentConfig(config); toast.success("Configuration saved"); }}>Save Configuration</Button>
                <Button variant="ghost" size="sm" onClick={checkHealth}>Test connection</Button>
                <span className="ml-auto flex items-center gap-1.5 text-xs">
                  <span className={`h-2 w-2 rounded-full ${health === "ok" ? "bg-[color:var(--success)]" : health === "fail" ? "bg-[color:var(--danger)]" : "bg-muted-foreground"}`} />
                  {health === "ok" ? "Connected" : health === "fail" ? "Unreachable" : "—"}
                </span>
              </div>

              <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Advanced
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-3 gap-2">
                  <NumberField label="Max concurrent" value={config.maxConcurrent} onChange={(v) => setConfig({ ...config, maxConcurrent: v })} />
                  <NumberField label="Delay (ms)" value={config.requestDelayMs} onChange={(v) => setConfig({ ...config, requestDelayMs: v })} />
                  <NumberField label="Timeout (min)" value={config.scanTimeoutMin} onChange={(v) => setConfig({ ...config, scanTimeoutMin: v })} />
                </div>
              )}
              <div className="border-t border-[color:var(--glass-border)] pt-4">
                <EmptyState icon={Radar} title="No active scan" body="Launch a target to begin." />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Live Tracking</h2>
                <div className="flex items-center gap-2">
                  {scanState === "running" && <Button size="sm" variant="destructive" onClick={abortScan}><XOctagon className="h-3.5 w-3.5 mr-1" /> Abort</Button>}
                  <Button size="sm" variant="ghost" onClick={() => { setTracking(null); setSummary(null); setScanState("running"); }}>Close</Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Elapsed: <span className="font-mono text-foreground">{formatElapsed(elapsed)}</span>
                {scanState === "aborted" && <span className="ml-2 text-[color:var(--danger)]">· paused</span>}
                {scanState === "completed" && <span className="ml-2 text-[color:var(--success)]">· complete</span>}
              </div>
              <PhaseStrip phaseIdx={tracking.phaseIdx} />
              {scanState === "completed" && summary && (
                <div className="rounded-md border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 p-3 space-y-2">
                  <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" /> Scan Complete</div>
                  <div className="flex flex-wrap gap-3 text-xs font-mono">
                    <span className="text-[color:var(--sev-critical)]">{summary.critical} Critical</span>
                    <span className="text-[color:var(--sev-high)]">{summary.high} High</span>
                    <span className="text-[color:var(--sev-medium)]">{summary.medium} Medium</span>
                    <span className="text-[color:var(--sev-low)]">{summary.low} Low</span>
                  </div>
                  <Link to="/report" className="inline-flex items-center gap-1 text-xs text-[color:var(--primary)] hover:underline">
                    <LinkIcon className="h-3 w-3" /> View Full Report
                  </Link>
                </div>
              )}
              <div className="rounded-md border border-[color:var(--glass-border)] bg-[#0a0a0f] p-2 h-[300px] overflow-y-auto font-mono text-[11px] space-y-1">
                {liveLogs.length === 0 && <p className="text-muted-foreground">Awaiting agent activity<span className="blink">▍</span></p>}
                {liveLogs.map((l) => (
                  <div key={l.id} className="flex items-start gap-2 slide-in-bottom">
                    <span className="text-muted-foreground">{new Date(l.timestamp).toLocaleTimeString()}</span>
                    <AgentBadge name={l.agent_name} />
                    <span>{l.log_message}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function EngineOfflineCard({ onRetry }: { onRetry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-md border border-[color:var(--danger)]/50 bg-[color:var(--danger)]/10 p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold text-[color:var(--danger)]">
        <ServerCrash className="h-4 w-4" /> Agent Engine Offline
      </div>
      <p className="text-xs text-muted-foreground">Start your local Python backend to run scans.</p>
      <pre className="rounded-md border border-[color:var(--glass-border)] bg-[#0a0a0f] p-3 font-mono text-[11px] whitespace-pre-wrap">{`cd core_engine\npython main.py`}</pre>
      <Button size="sm" variant="secondary" onClick={async () => { setBusy(true); await onRetry(); setBusy(false); }} disabled={busy}>
        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${busy ? "animate-spin" : ""}`} /> Retry Connection
      </Button>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] px-3 py-2">
      <Label className="text-xs leading-tight">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="font-mono h-8" />
    </div>
  );
}

function PhaseStrip({ phaseIdx }: { phaseIdx: number }) {
  const pct = phaseIdx < 0 ? 0 : ((phaseIdx + 1) / AGENT_PHASES.length) * 100;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        {AGENT_PHASES.map((p, i) => (
          <span key={p} className={i === phaseIdx ? "text-[color:var(--primary)]" : i < phaseIdx ? "text-[color:var(--success)]" : ""}>{p}</span>
        ))}
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full bg-[color:var(--primary)] transition-[width] duration-700 glow-blue" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatElapsed(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}