import { useEffect, useRef, useState } from "react";
import { Plus, FileText, Crosshair, Zap, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { loadAgentConfig } from "@/lib/agent-config";
import { getEngineStatus } from "@/lib/engine-status";
import { cn } from "@/lib/utils";

const PROFILES = ["Passive Recon Only", "Active OWASP Scan", "API Deep-Dive", "Full Autonomous (all phases)"];

export function QuickActionFab() {
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const actions = [
    { Icon: FileText, label: "New Note", color: "bg-[color:var(--agent-planner)]", onClick: () => { sessionStorage.setItem("kelsai.notes.autoNew", "1"); navigate({ to: "/notes" }); setOpen(false); } },
    { Icon: Crosshair, label: "Add Target", color: "bg-[color:var(--primary)]", onClick: () => { sessionStorage.setItem("kelsai.targets.autofocus", "1"); navigate({ to: "/targets" }); setOpen(false); } },
    { Icon: Zap, label: "Quick Scan", color: "bg-[color:var(--gold)]", onClick: () => { setQuickOpen(true); setOpen(false); } },
  ];

  return (
    <>
      <div ref={ref} className="fixed right-6 bottom-20 z-40 flex flex-col-reverse items-end gap-3">
        {open && actions.map((a, i) => (
          <div key={a.label} className="flex items-center gap-2 fab-pop" style={{ animationDelay: `${i * 50}ms` }}>
            <span className="rounded-md bg-black/70 px-2 py-1 text-[11px] text-white shadow">{a.label}</span>
            <button
              onClick={a.onClick}
              className={cn("flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg", a.color)}
              aria-label={a.label}
            >
              <a.Icon className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Quick Actions"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--primary)] text-white shadow-[0_8px_24px_-6px_var(--primary)] hover:scale-105 transition-transform"
        >
          {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </button>
      </div>

      <QuickScanModal open={quickOpen} onOpenChange={setQuickOpen} />
    </>
  );
}

function QuickScanModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [domain, setDomain] = useState("");
  const [profile, setProfile] = useState(PROFILES[1]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { if (open) setDomain(""); }, [open]);

  async function launch() {
    if (!domain.trim()) { toast.error("Domain is required"); return; }
    if (getEngineStatus() === "offline") {
      toast.error("Agent engine is offline — start the backend first");
      return;
    }
    setBusy(true);
    const cfg = loadAgentConfig();
    const { data, error } = await supabase
      .from("targets")
      .insert({ domain_url: domain.trim(), status: "scanning", testing_profile: profile })
      .select("*").single();
    if (error || !data) { toast.error("Could not create target"); setBusy(false); return; }
    fetch(cfg.backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_url: domain.trim(), profile, supabase_target_id: data.id, api_key: cfg.apiKey }),
    }).catch(() => {});
    toast.success("Quick scan launched", { description: data.domain_url });
    onOpenChange(false);
    setBusy(false);
    navigate({ to: "/targets" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-[color:var(--gold)]" /> Quick Scan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Root Domain</Label>
            <Input autoFocus value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="https://target.com" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Testing Profile</Label>
            <Select value={profile} onValueChange={setProfile}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROFILES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={launch} disabled={busy} className="w-full bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90">
            <Zap className="mr-2 h-4 w-4" /> Launch Scan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}