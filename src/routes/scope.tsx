import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Check, Shield, X } from "lucide-react";
import { useActiveTarget } from "@/contexts/ActiveTargetContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/scope")({
  head: () => ({ meta: [{ title: "Scope Manager — Kels.Ai" }] }),
  component: ScopeManager,
});

type Target = { id: string; domain_url: string };
type Cfg = {
  id?: string;
  target_id: string | null;
  program_name: string;
  platform: string;
  program_url: string;
  in_scope_assets: string;
  out_of_scope_assets: string;
  special_rules: string;
  reward_critical_min: number | null; reward_critical_max: number | null;
  reward_high_min: number | null; reward_high_max: number | null;
  reward_medium_min: number | null; reward_medium_max: number | null;
  reward_low_min: number | null; reward_low_max: number | null;
};

const EMPTY: Cfg = {
  target_id: null, program_name: "", platform: "HackerOne", program_url: "",
  in_scope_assets: "", out_of_scope_assets: "", special_rules: "",
  reward_critical_min: null, reward_critical_max: null,
  reward_high_min: null, reward_high_max: null,
  reward_medium_min: null, reward_medium_max: null,
  reward_low_min: null, reward_low_max: null,
};

function ScopeManager() {
  const { target, setTarget } = useActiveTarget();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [cfg, setCfg] = useState<Cfg>(EMPTY);
  const [checkUrl, setCheckUrl] = useState("");
  const [check, setCheck] = useState<null | { ok: boolean; reason: string }>(null);

  useEffect(() => {
    supabase.from("targets").select("id,domain_url").then(({ data }) => {
      const ts = (data as Target[]) ?? [];
      setTargets(ts);
      if (!target && ts[0]) setTarget(ts[0]);
    });
  }, []);

  useEffect(() => {
    if (!target?.id) return;
    supabase.from("program_configs").select("*").eq("target_id", target.id).order("updated_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setCfg((data as any) ?? { ...EMPTY, target_id: target.id }));
  }, [target?.id]);

  async function save() {
    if (!target?.id) { toast.error("Pick a target"); return; }
    const payload = { ...cfg, target_id: target.id };
    let res;
    if (cfg.id) res = await supabase.from("program_configs").update(payload).eq("id", cfg.id);
    else res = await supabase.from("program_configs").insert(payload).select().single();
    if (res.error) toast.error(res.error.message);
    else { toast.success("Program config saved"); if ((res as any).data) setCfg((res as any).data); }
  }

  function validate() {
    if (!checkUrl) return;
    const lower = checkUrl.toLowerCase();
    const matches = (lines: string) => lines.split(/\r?\n/).map(s => s.trim()).filter(Boolean).some((rule) => matchRule(rule, lower));
    if (matches(cfg.out_of_scope_assets)) { setCheck({ ok: false, reason: "Matched an out-of-scope rule" }); return; }
    if (matches(cfg.in_scope_assets)) { setCheck({ ok: true, reason: "Matched an in-scope rule" }); return; }
    setCheck({ ok: false, reason: "No matching in-scope rule" });
  }

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-glow-blue flex items-center gap-2"><Shield className="h-6 w-6 text-[color:var(--primary)]" /> Scope Manager</h1>
        <p className="text-sm text-muted-foreground">Define and validate testing scope for each bug bounty program</p>
      </header>

      <div className="glass p-3 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Active target</Label>
        <Select
          value={target?.id ?? ""}
          onValueChange={(id) => { const t = targets?.find(x => x.id === id); if (t) setTarget(t); }}
        >
          <SelectTrigger className="w-[320px] font-mono text-xs"><SelectValue placeholder="Select target" /></SelectTrigger>
          <SelectContent>
            {(targets ?? []).map(t => <SelectItem key={t.id} value={t.id}>{t.domain_url}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass p-5 space-y-4">
          <h2 className="text-sm font-semibold">Program Context</h2>
          <div className="space-y-3">
            <div>
              <Label>Program Name</Label>
              <Input value={cfg.program_name} onChange={e => setCfg({ ...cfg, program_name: e.target.value })} placeholder="e.g. Tesla VDP" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Platform</Label>
                <Select value={cfg.platform} onValueChange={v => setCfg({ ...cfg, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["HackerOne","Bugcrowd","Intigriti","Immunefi","YesWeHack","Private","Other"].map(p =>
                      <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Program URL</Label>
                <Input value={cfg.program_url} onChange={e => setCfg({ ...cfg, program_url: e.target.value })} placeholder="https://…" />
              </div>
            </div>
            <div>
              <Label>In-Scope Assets (one per line)</Label>
              <Textarea rows={4} className="font-mono text-xs" value={cfg.in_scope_assets} onChange={e => setCfg({ ...cfg, in_scope_assets: e.target.value })} placeholder={"*.example.com\napi.example.com"} />
            </div>
            <div>
              <Label>Out-of-Scope Assets (one per line)</Label>
              <Textarea rows={4} className="font-mono text-xs" value={cfg.out_of_scope_assets} onChange={e => setCfg({ ...cfg, out_of_scope_assets: e.target.value })} placeholder={"staging.example.com"} />
            </div>
            <div>
              <Label>Special Rules / Notes</Label>
              <Textarea rows={3} value={cfg.special_rules} onChange={e => setCfg({ ...cfg, special_rules: e.target.value })} placeholder="Do not test payment flows…" />
            </div>
            <div>
              <Label>Reward Tiers ($)</Label>
              <div className="space-y-1.5 mt-1">
                {(["critical","high","medium","low"] as const).map((tier) => (
                  <RewardRow key={tier} tier={tier} cfg={cfg} setCfg={setCfg} />
                ))}
              </div>
            </div>
            <Button onClick={save} className="w-full">Save Program Config</Button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-md border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-3 text-sm text-[color:var(--gold)] flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Always verify scope before testing. Out-of-scope testing may have legal consequences.</span>
          </div>
          <div className="glass p-5 space-y-3">
            <h2 className="text-sm font-semibold">Scope Validator</h2>
            <Label>Check if URL is in scope</Label>
            <div className="flex gap-2">
              <Input value={checkUrl} onChange={e => setCheckUrl(e.target.value)} placeholder="https://api.example.com/v1/users" className="font-mono" />
              <Button onClick={validate}>Validate</Button>
            </div>
            {check && (
              <div className={`rounded-md border p-4 text-center font-semibold ${check.ok
                ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]"
                : "border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 text-[color:var(--danger)]"}`}>
                <div className="flex items-center justify-center gap-2 text-lg">
                  {check.ok ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                  {check.ok ? "In Scope" : "Out of Scope"}
                </div>
                <div className="text-xs font-normal mt-1 opacity-80">{check.reason}</div>
              </div>
            )}
          </div>
          <div className="glass p-5 space-y-2">
            <h2 className="text-sm font-semibold">Active Program</h2>
            {targets === null ? <Skeleton className="h-32" /> : (
              <div className="text-sm space-y-2">
                <div><span className="text-muted-foreground">Program:</span> {cfg.program_name || "—"} <span className="text-muted-foreground">({cfg.platform})</span></div>
                <ScopeBlock label="In Scope" text={cfg.in_scope_assets} ok />
                <ScopeBlock label="Out of Scope" text={cfg.out_of_scope_assets} />
                {cfg.special_rules && <div className="rounded-md bg-white/5 p-2 text-xs text-muted-foreground whitespace-pre-wrap">{cfg.special_rules}</div>}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ScopeBlock({ label, text, ok }: { label: string; text: string; ok?: boolean }) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {lines.length === 0 ? <div className="text-xs text-muted-foreground">none</div> : (
        <ul className="space-y-0.5">
          {lines.map((l, i) => (
            <li key={i} className={`font-mono text-xs ${ok ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}`}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RewardRow({ tier, cfg, setCfg }: { tier: "critical"|"high"|"medium"|"low"; cfg: Cfg; setCfg: (c: Cfg) => void }) {
  const minK = `reward_${tier}_min` as keyof Cfg;
  const maxK = `reward_${tier}_max` as keyof Cfg;
  const color: Record<string,string> = { critical: "var(--sev-critical)", high: "var(--sev-high)", medium: "var(--sev-medium)", low: "var(--sev-low)" };
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 capitalize font-semibold" style={{ color: color[tier] }}>{tier}</span>
      <Input type="number" placeholder="min" value={(cfg[minK] as number | null) ?? ""} onChange={e => setCfg({ ...cfg, [minK]: e.target.value ? Number(e.target.value) : null } as Cfg)} className="h-8" />
      <span className="text-muted-foreground">–</span>
      <Input type="number" placeholder="max" value={(cfg[maxK] as number | null) ?? ""} onChange={e => setCfg({ ...cfg, [maxK]: e.target.value ? Number(e.target.value) : null } as Cfg)} className="h-8" />
    </div>
  );
}

function matchRule(rule: string, url: string): boolean {
  // regex literal like /^https:\/\/.*\.tesla\.com/
  if (rule.startsWith("/") && rule.lastIndexOf("/") > 0) {
    try {
      const last = rule.lastIndexOf("/");
      const body = rule.slice(1, last);
      const flags = rule.slice(last + 1);
      return new RegExp(body, flags || "i").test(url);
    } catch { return false; }
  }
  // wildcard like *.example.com
  if (rule.startsWith("*.")) {
    const host = rule.slice(2).toLowerCase();
    return url.includes("://") ? new URL(url).hostname.endsWith(host) : url.includes(host);
  }
  return url.includes(rule.toLowerCase());
}