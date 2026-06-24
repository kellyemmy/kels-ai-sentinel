import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KelsLogo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Rocket, Cpu, Crosshair, FileText, ClipboardList, CheckCircle2, XCircle } from "lucide-react";
import { loadAgentConfig, saveAgentConfig } from "@/lib/agent-config";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — Kels.Ai" }] }),
  component: Onboarding,
});

const PROFILES = ["Passive Recon Only", "Active OWASP Scan", "API Deep-Dive", "Full Autonomous (all phases)"];

function Onboarding() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState(loadAgentConfig());
  const [health, setHealth] = useState<"unknown" | "ok" | "fail">("unknown");
  const [target, setTarget] = useState({ domain: "", profile: PROFILES[1], program: "" });
  const navigate = useNavigate();

  async function testConnection() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3500);
      const r = await fetch(`${config.backendUrl.replace(/\/$/, "")}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      setHealth(r.ok ? "ok" : "fail");
      saveAgentConfig(config);
    } catch { setHealth("fail"); }
  }

  async function addTarget() {
    if (!target.domain.trim()) return;
    await supabase.from("targets").insert({
      domain_url: target.domain.trim(),
      status: "idle",
      testing_profile: target.profile,
    });
    toast.success("Target added");
    setStep(4);
  }

  async function finish() {
    await supabase.auth.updateUser({ data: { onboarding_complete: true } });
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
      <div className="glass w-full max-w-2xl p-8 space-y-6">
        <div className="flex justify-center"><KelsLogo size={48} /></div>

        {step === 1 && (
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-glow-blue">Welcome to Kels.Ai</h1>
            <p className="text-sm text-muted-foreground">Your autonomous penetration intelligence platform</p>
            <p className="text-sm max-w-md mx-auto">
              Kels.Ai orchestrates autonomous AI agents to discover, exploit and report web &amp; API vulnerabilities.
              Configure your AI engine, add a target, and let the agents do the rest.
            </p>
            <Button onClick={() => setStep(2)} className="bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90"><Rocket className="mr-2 h-4 w-4" />Get Started</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Cpu className="h-5 w-5 text-[color:var(--primary)]" /><h2 className="text-xl font-bold">Connect the AI Engine</h2></div>
            <p className="text-sm text-muted-foreground">Kels.Ai requires a local Python backend to run autonomous scans. Enter your backend URL below.</p>
            <div className="space-y-1.5">
              <Label>Agent Backend URL</Label>
              <Input value={config.backendUrl} onChange={(e) => setConfig({ ...config, backendUrl: e.target.value })} className="font-mono" />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={testConnection} variant="secondary">Test Connection</Button>
              {health === "ok" && <span className="text-xs text-[color:var(--success)] flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Connected</span>}
              {health === "fail" && <span className="text-xs text-[color:var(--danger)] flex items-center gap-1"><XCircle className="h-3 w-3" />Unreachable</span>}
            </div>
            <div className="flex items-center justify-between pt-4">
              <button onClick={() => setStep(3)} className="text-xs text-muted-foreground hover:text-foreground">Skip for now</button>
              <Button onClick={() => { saveAgentConfig(config); setStep(3); }} className="bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90">Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Crosshair className="h-5 w-5 text-[color:var(--primary)]" /><h2 className="text-xl font-bold">Add Your First Target</h2></div>
            <div className="space-y-1.5"><Label>Root Domain</Label><Input value={target.domain} onChange={(e) => setTarget({ ...target, domain: e.target.value })} placeholder="https://example.com" className="font-mono" /></div>
            <div className="space-y-1.5"><Label>Testing Profile</Label>
              <Select value={target.profile} onValueChange={(v) => setTarget({ ...target, profile: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROFILES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Program Name</Label><Input value={target.program} onChange={(e) => setTarget({ ...target, program: e.target.value })} placeholder="Public BB Program" /></div>
            <div className="flex items-center justify-between pt-4">
              <button onClick={() => setStep(4)} className="text-xs text-muted-foreground hover:text-foreground">Skip for now</button>
              <Button onClick={addTarget} className="bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90">Add Target</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 text-center">
            <h2 className="text-2xl font-bold text-glow-blue">You're all set!</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FeatureCard icon={Rocket} title="Launch a Scan" body="Open Target Manager and start an autonomous scan." />
              <FeatureCard icon={FileText} title="Track Findings" body="Vulnerability Tracker updates in real time." />
              <FeatureCard icon={ClipboardList} title="Build Reports" body="Export professional pen-test reports instantly." />
            </div>
            <Button onClick={finish} className="bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90">Go to Dashboard</Button>
          </div>
        )}

        <div className="flex justify-center gap-1.5">
          {[1,2,3,4].map((i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i === step ? "bg-[color:var(--primary)]" : "bg-white/10"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] p-3 text-left">
      <Icon className="h-5 w-5 text-[color:var(--primary)] mb-2" />
      <div className="font-semibold text-sm">{title}</div>
      <p className="text-[11px] text-muted-foreground mt-1">{body}</p>
    </div>
  );
}