import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calculator, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// CVSS 3.1 minimal calculator
type Metric = { key: string; label: string; options: { v: string; label: string; w: number }[] };

const BASE: Metric[] = [
  { key: "AV", label: "Attack Vector", options: [
    { v: "N", label: "Network", w: 0.85 }, { v: "A", label: "Adjacent", w: 0.62 },
    { v: "L", label: "Local", w: 0.55 }, { v: "P", label: "Physical", w: 0.2 },
  ]},
  { key: "AC", label: "Attack Complexity", options: [
    { v: "L", label: "Low", w: 0.77 }, { v: "H", label: "High", w: 0.44 },
  ]},
  { key: "PR", label: "Privileges Required", options: [
    { v: "N", label: "None", w: 0.85 }, { v: "L", label: "Low", w: 0.62 }, { v: "H", label: "High", w: 0.27 },
  ]},
  { key: "UI", label: "User Interaction", options: [
    { v: "N", label: "None", w: 0.85 }, { v: "R", label: "Required", w: 0.62 },
  ]},
  { key: "S", label: "Scope", options: [
    { v: "U", label: "Unchanged", w: 0 }, { v: "C", label: "Changed", w: 1 },
  ]},
  { key: "C", label: "Confidentiality", options: [
    { v: "N", label: "None", w: 0 }, { v: "L", label: "Low", w: 0.22 }, { v: "H", label: "High", w: 0.56 },
  ]},
  { key: "I", label: "Integrity", options: [
    { v: "N", label: "None", w: 0 }, { v: "L", label: "Low", w: 0.22 }, { v: "H", label: "High", w: 0.56 },
  ]},
  { key: "A", label: "Availability", options: [
    { v: "N", label: "None", w: 0 }, { v: "L", label: "Low", w: 0.22 }, { v: "H", label: "High", w: 0.56 },
  ]},
];

const DEFAULT_VEC: Record<string, string> = { AV:"N", AC:"L", PR:"N", UI:"N", S:"U", C:"N", I:"N", A:"N" };

function roundUp(n: number) { return Math.ceil(n * 10) / 10; }

function calcScore(sel: Record<string, string>) {
  const get = (k: string) => BASE.find(m => m.key === k)!.options.find(o => o.v === sel[k])!.w;
  // PR weight depends on scope
  let pr = get("PR");
  if (sel.S === "C") {
    if (sel.PR === "L") pr = 0.68;
    if (sel.PR === "H") pr = 0.5;
  }
  const iss = 1 - (1 - get("C")) * (1 - get("I")) * (1 - get("A"));
  const impact = sel.S === "U" ? 6.42 * iss : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  const exploit = 8.22 * get("AV") * get("AC") * pr * get("UI");
  if (impact <= 0) return 0;
  const base = sel.S === "U" ? Math.min(impact + exploit, 10) : Math.min(1.08 * (impact + exploit), 10);
  return roundUp(base);
}

function severityFor(s: number) {
  if (s === 0) return { label: "None", color: "var(--muted-foreground)" };
  if (s < 4) return { label: "Low", color: "var(--sev-low)" };
  if (s < 7) return { label: "Medium", color: "var(--sev-medium)" };
  if (s < 9) return { label: "High", color: "var(--sev-high)" };
  return { label: "Critical", color: "var(--sev-critical)" };
}

type OpenDetail = { vulnId?: string };

export function openCvss(detail: OpenDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("kelsai:open-cvss", { detail }));
}

export function CvssCalculatorHost() {
  const [open, setOpen] = useState(false);
  const [vulnId, setVulnId] = useState<string | undefined>(undefined);
  const [sel, setSel] = useState<Record<string, string>>(DEFAULT_VEC);

  useEffect(() => {
    function onOpen(e: Event) {
      const ce = e as CustomEvent<OpenDetail>;
      setVulnId(ce.detail?.vulnId);
      setOpen(true);
    }
    window.addEventListener("kelsai:open-cvss", onOpen as EventListener);
    return () => window.removeEventListener("kelsai:open-cvss", onOpen as EventListener);
  }, []);

  const score = useMemo(() => calcScore(sel), [sel]);
  const sev = severityFor(score);
  const vector = `CVSS:3.1/${BASE.map(m => `${m.key}:${sel[m.key]}`).join("/")}`;

  async function applyToFinding() {
    if (!vulnId) { toast.info("Open from a vulnerability to apply"); return; }
    const { error } = await supabase.from("vulnerabilities")
      .update({ cvss_score: score, severity: sev.label })
      .eq("id", vulnId);
    if (error) toast.error("Update failed");
    else { toast.success(`Applied ${score} (${sev.label})`); setOpen(false); }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => openCvss()}
        title="CVSS Calculator"
        className="fixed bottom-5 left-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/15 text-[color:var(--gold)] shadow-[0_0_24px_-6px_var(--gold)] backdrop-blur hover:bg-[color:var(--gold)]/25"
      >
        <Calculator className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>CVSS 3.1 Score Calculator</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="glass p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Base Score</div>
              <div className="text-5xl font-bold" style={{ color: sev.color, textShadow: `0 0 12px ${sev.color}` }}>{score.toFixed(1)}</div>
              <div className="text-xs font-semibold" style={{ color: sev.color }}>{sev.label}</div>
              <div className="mt-2 font-mono text-[10px] text-muted-foreground break-all">{vector}</div>
              <div className="mt-3 flex justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(vector); toast.success("Copied"); }}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy Vector
                </Button>
                <Button size="sm" onClick={applyToFinding} disabled={!vulnId}>Apply to Finding</Button>
              </div>
            </div>
            {BASE.map((m) => (
              <div key={m.key}>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{m.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {m.options.map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setSel({ ...sel, [m.key]: o.v })}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        sel[m.key] === o.v
                          ? "border-[color:var(--primary)] bg-[color:var(--primary)]/15 text-[color:var(--primary)]"
                          : "border-[color:var(--glass-border)] bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}