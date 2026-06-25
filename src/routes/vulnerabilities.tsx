import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Copy, Calculator, Code2, GitCompare, ChevronRight as ArrowR } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SeverityBadge, VulnStatusBadge, VULN_STATUSES, VULN_STATUS_LABEL, VULN_STATUS_COLOR, type VulnStatus } from "@/components/Badges";
import { OWASP_CATEGORIES, SEVERITIES } from "@/lib/owasp";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { z } from "zod";
import { openCvss } from "@/components/CvssCalculator";
import { openPayloads } from "@/components/PayloadLibrary";
import { ScanComparison } from "@/components/ScanComparison";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ open: z.string().optional() });

export const Route = createFileRoute("/vulnerabilities")({
  head: () => ({ meta: [{ title: "Vulnerability Tracker — Kels.Ai" }] }),
  validateSearch: searchSchema,
  component: Tracker,
});

type Vuln = {
  id: string; title: string; description: string | null;
  severity: string | null; owasp_category: string | null;
  proof_of_concept: string | null; remediation: string | null;
  status: string | null; discovered_at: string; cvss_score: number | null;
};

function Tracker() {
  const navigate = useNavigate();
  const { open: openId } = Route.useSearch();
  const [items, setItems] = useState<Vuln[] | null>(null);
  const [sev, setSev] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);

  async function load() {
    const { data } = await supabase.from("vulnerabilities").select("*").order("discovered_at", { ascending: false });
    setItems((data ?? []) as Vuln[]);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("vuln-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "vulnerabilities" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    if (!items) return null;
    return items.filter((v) => {
      if (sev !== "all" && v.severity !== sev) return false;
      if (cat !== "all" && v.owasp_category !== cat) return false;
      if (status !== "all" && v.status !== status) return false;
      if (q && !(v.title.toLowerCase().includes(q.toLowerCase()) || (v.description ?? "").toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [items, sev, cat, status, q]);

  const opened = items?.find((v) => v.id === openId) ?? null;

  const counts = useMemo(() => {
    const c: Record<string, number> = { open: 0, in_progress: 0, verified: 0, submitted: 0, false_positive: 0 };
    (items ?? []).forEach((v) => { const s = v.status ?? "open"; if (s in c) c[s]++; });
    return c;
  }, [items]);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-glow-blue">Vulnerability Tracker</h1>
          <p className="text-sm text-muted-foreground">Triage and report findings across all targets</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCompareOpen((v) => !v)}>
          <GitCompare className="h-3.5 w-3.5 mr-1" /> {compareOpen ? "Close Compare" : "Compare"}
        </Button>
      </header>

      {/* Kanban status strip */}
      <div className="flex flex-wrap items-center gap-2">
        {(VULN_STATUSES as readonly VulnStatus[]).map((s, i) => {
          const isActive = status === s;
          const c = VULN_STATUS_COLOR[s];
          return (
            <div key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatus(isActive ? "all" : s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  isActive ? cn(c.bg, c.text, c.border, "shadow-[0_0_0_2px_var(--background),0_0_0_3px_currentColor]") : cn("border-[color:var(--glass-border)] bg-white/[0.02] hover:bg-white/[0.06]", c.text)
                )}
              >
                {VULN_STATUS_LABEL[s]}: <span className="font-mono">{counts[s] ?? 0}</span>
              </button>
              {i < VULN_STATUSES.length - 1 && <ArrowR className="h-3 w-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {compareOpen ? (
        <ScanComparison onClose={() => setCompareOpen(false)} />
      ) : (
      <>

      <div className="glass p-3 flex flex-wrap gap-2">
        <Select value={sev} onValueChange={setSev}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="OWASP" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {OWASP_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(VULN_STATUSES as readonly VulnStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{VULN_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or description…" className="w-[280px]" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered === null && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        {filtered && filtered.length === 0 && (
          <div className="col-span-full glass p-10 text-center text-muted-foreground">
            No findings match your filters.
          </div>
        )}
        {filtered?.map((v) => (
          <article key={v.id} className="glass p-4 space-y-2 hover:bg-white/[0.05] transition-colors">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={v.severity ?? "Low"} />
              <VulnStatusBadge status={v.status} />
              <span className="text-[11px] text-muted-foreground font-mono">{v.owasp_category}</span>
            </div>
            <h3 className="font-semibold text-white leading-tight">{v.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{v.description}</p>
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="capitalize text-muted-foreground">{(v.status ?? "open").replace("_", " ")} · {new Date(v.discovered_at).toLocaleDateString()}</span>
              <button
                className="inline-flex items-center gap-1 text-[color:var(--primary)] hover:underline"
                onClick={() => navigate({ to: "/vulnerabilities", search: { open: v.id } })}
              >
                View Details <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </article>
        ))}
      </div>
      </>
      )}

      <Sheet open={!!opened} onOpenChange={(v) => { if (!v) navigate({ to: "/vulnerabilities", search: {} }); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {opened && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">{opened.title}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={opened.severity ?? "Low"} />
                  <VulnStatusBadge status={opened.status} />
                  <span className="text-xs text-muted-foreground font-mono">{opened.owasp_category}</span>
                  {opened.cvss_score != null && <span className="text-xs">CVSS <span className="font-mono">{opened.cvss_score}</span></span>}
                </div>
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Description</h4>
                  <p className="text-sm">{opened.description}</p>
                </section>
                <section>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Proof of Concept</h4>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(opened.proof_of_concept ?? ""); toast.success("Copied PoC"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <pre className="rounded-md border border-[color:var(--glass-border)] bg-[#0a0a0f] p-3 font-mono text-[11px] whitespace-pre-wrap">{opened.proof_of_concept}</pre>
                </section>
                <section className="rounded-md border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 p-3">
                  <h4 className="text-xs uppercase tracking-wider text-[color:var(--success)] mb-1">Remediation</h4>
                  <p className="text-sm">{opened.remediation}</p>
                </section>
                <section className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Select
                    value={opened.status ?? "open"}
                    onValueChange={async (newStatus) => {
                      await supabase.from("vulnerabilities").update({ status: newStatus }).eq("id", opened.id);
                      toast.success("Status updated");
                    }}
                  >
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(VULN_STATUSES as readonly VulnStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{VULN_STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const md = bugcrowdMarkdown(opened);
                    navigator.clipboard.writeText(md);
                    toast.success("Copied Bugcrowd report");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy as Bugcrowd Report
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => openCvss({ vulnId: opened.id })}>
                    <Calculator className="h-4 w-4 mr-2" /> CVSS Calculator
                  </Button>
                  <Button variant="secondary" onClick={() => openPayloads()}>
                    <Code2 className="h-4 w-4 mr-2" /> Payload Library
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function bugcrowdMarkdown(v: Vuln) {
  return (
`**Title:** ${v.title}
**Severity:** ${v.severity}
**OWASP Category:** ${v.owasp_category}

**Description:**
${v.description ?? ""}

**Steps to Reproduce / Proof of Concept:**
${v.proof_of_concept ?? ""}

**Impact:**
(leave blank for user to fill)

**Remediation:**
${v.remediation ?? ""}
`);
}