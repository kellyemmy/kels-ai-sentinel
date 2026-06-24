import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Rocket, Cpu, Eye, EyeOff, ChevronDown, ChevronRight, XOctagon } from "lucide-react";
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
import { KeyRound, Crosshair } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

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
  const phaseTimer = useRef<number | null>(null);

  useEffect(() => { setConfig(loadAgentConfig()); }, []);
  useEffect(() => { saveForm("kelsai.target.form", form); }, [form]);

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
    if (!tracking) return;
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - tracking.startedAt) / 1000)), 1000);
    phaseTimer.current = window.setInterval(() => {
      setTracking((cur) => cur ? { ...cur, phaseIdx: Math.min(cur.phaseIdx + 1, AGENT_PHASES.length - 1) } : cur);
    }, 6000) as unknown as number;
    return () => {
      window.clearInterval(t);
      if (phaseTimer.current) window.clearInterval(phaseTimer.current);
    };
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
  }

  async function abortScan() {
    if (!tracking) return;
    fetch(`${config.backendUrl.replace(/\/$/, "")}/agent/${tracking.targetId}`, { method: "DELETE" }).catch(() => {});
    await supabase.from("targets").update({ status: "idle" }).eq("id", tracking.targetId);
    toast("Scan aborted");
    setTracking(null);
  }

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
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Past Targets</h3>
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
                  <TargetStatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT — AI Control Center / Live Tracking */}
        <section className="glass p-5 lg:col-span-2 space-y-4">
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
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Live Tracking</h2>
                <Button size="sm" variant="destructive" onClick={abortScan}><XOctagon className="h-3.5 w-3.5 mr-1" /> Abort Scan</Button>
              </div>
              <div className="text-xs text-muted-foreground">Elapsed: <span className="font-mono text-foreground">{formatElapsed(elapsed)}</span></div>
              <PhaseStrip phaseIdx={tracking.phaseIdx} />
              <div className="rounded-md border border-[color:var(--glass-border)] bg-[#0a0a0f] p-2 h-[300px] overflow-y-auto font-mono text-[11px] space-y-1">
                {liveLogs.length === 0 && <p className="text-muted-foreground">Awaiting agent activity<span className="blink">▍</span></p>}
                {liveLogs.map((l) => (
                  <div key={l.id} className="flex items-start gap-2 slide-in-up">
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