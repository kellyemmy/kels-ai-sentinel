import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Copy } from "lucide-react";
import { SeverityBadge } from "@/components/Badges";
import { toast } from "sonner";

type Target = { id: string; domain_url: string; created_at: string };
type Vuln = { id: string; title: string; severity: string | null; target_id: string | null };

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function ScanComparison({ onClose }: { onClose: () => void }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [baselineId, setBaselineId] = useState<string>("");
  const [compareId, setCompareId] = useState<string>("");
  const [baseVulns, setBaseVulns] = useState<Vuln[] | null>(null);
  const [newVulns, setNewVulns] = useState<Vuln[] | null>(null);

  useEffect(() => {
    supabase.from("targets").select("id, domain_url, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setTargets((data ?? []) as Target[]));
  }, []);

  async function runCompare() {
    if (!baselineId || !compareId) { toast.error("Pick two scans"); return; }
    const [a, b] = await Promise.all([
      supabase.from("vulnerabilities").select("id, title, severity, target_id").eq("target_id", baselineId),
      supabase.from("vulnerabilities").select("id, title, severity, target_id").eq("target_id", compareId),
    ]);
    setBaseVulns((a.data ?? []) as Vuln[]);
    setNewVulns((b.data ?? []) as Vuln[]);
  }

  const diff = useMemo(() => {
    if (!baseVulns || !newVulns) return null;
    const baseKeys = new Set(baseVulns.map(v => norm(v.title)));
    const newKeys = new Set(newVulns.map(v => norm(v.title)));
    return {
      fixed: baseVulns.filter(v => !newKeys.has(norm(v.title))),
      unchanged: baseVulns.filter(v => newKeys.has(norm(v.title))),
      added: newVulns.filter(v => !baseKeys.has(norm(v.title))),
    };
  }, [baseVulns, newVulns]);

  function exportReport() {
    if (!diff) return;
    const md = [
      `# Scan Comparison`,
      ``,
      `**Baseline:** ${labelFor(targets, baselineId)}`,
      `**Compare:**  ${labelFor(targets, compareId)}`,
      ``,
      `- ✓ Fixed: ${diff.fixed.length}`,
      `- = Unchanged: ${diff.unchanged.length}`,
      `- ✗ New: ${diff.added.length}`,
      ``,
      `## Fixed Since Baseline`,
      ...diff.fixed.map(v => `- [${v.severity}] ${v.title}`),
      ``,
      `## New Findings`,
      ...diff.added.map(v => `- [${v.severity}] ${v.title}`),
    ].join("\n");
    navigator.clipboard.writeText(md);
    toast.success("Comparison copied to clipboard");
  }

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Scan Comparison</h2>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1 flex-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground">Baseline Scan</label>
          <Select value={baselineId} onValueChange={setBaselineId}>
            <SelectTrigger><SelectValue placeholder="Pick a scan" /></SelectTrigger>
            <SelectContent>{targets.map(t => <SelectItem key={t.id} value={t.id}>{t.domain_url} · {new Date(t.created_at).toLocaleDateString()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground">Compare Against</label>
          <Select value={compareId} onValueChange={setCompareId}>
            <SelectTrigger><SelectValue placeholder="Pick a scan" /></SelectTrigger>
            <SelectContent>{targets.map(t => <SelectItem key={t.id} value={t.id}>{t.domain_url} · {new Date(t.created_at).toLocaleDateString()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={runCompare} className="bg-[color:var(--primary)]">Compare</Button>
      </div>

      {diff && (
        <>
          <div className="rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] px-3 py-2 text-sm flex flex-wrap gap-4">
            <span className="text-[color:var(--success)]">✓ {diff.fixed.length} fixed</span>
            <span className="text-muted-foreground">= {diff.unchanged.length} unchanged</span>
            <span className="text-[color:var(--danger)]">✗ {diff.added.length} new findings</span>
            <Button size="sm" variant="ghost" onClick={exportReport} className="ml-auto">
              <Copy className="h-3.5 w-3.5 mr-1" /> Export Comparison Report
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DiffColumn title="Fixed Since Baseline" tone="success" items={diff.fixed} />
            <DiffColumn title="Unchanged" tone="muted" items={diff.unchanged} />
            <DiffColumn title="New Findings" tone="danger" items={diff.added} />
          </div>
        </>
      )}
    </div>
  );
}

function DiffColumn({ title, items, tone }: { title: string; items: Vuln[]; tone: "success" | "danger" | "muted" }) {
  const headerCls = tone === "success" ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
    : tone === "danger" ? "bg-[color:var(--danger)]/15 text-[color:var(--danger)]"
    : "bg-white/[0.05] text-muted-foreground";
  const borderCls = tone === "success" ? "border-l-[color:var(--success)]"
    : tone === "danger" ? "border-l-[color:var(--danger)]"
    : "border-l-transparent";
  return (
    <div className="rounded-md border border-[color:var(--glass-border)] overflow-hidden">
      <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${headerCls}`}>{title} · {items.length}</div>
      <div className="max-h-[420px] overflow-y-auto p-2 space-y-1.5">
        {items.length === 0 && <div className="text-center text-xs text-muted-foreground py-6">None</div>}
        {items.map(v => (
          <div key={v.id} className={`rounded border-l-2 ${borderCls} border border-[color:var(--glass-border)] bg-white/[0.02] px-2.5 py-1.5`}>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={v.severity ?? "Low"} />
              <span className="text-xs truncate">{v.title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function labelFor(ts: Target[], id: string) {
  const t = ts.find(x => x.id === id);
  return t ? `${t.domain_url} (${new Date(t.created_at).toLocaleString()})` : id;
}