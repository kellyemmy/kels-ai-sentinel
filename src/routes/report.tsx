import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Download, Copy, FileText } from "lucide-react";
import { useActiveTarget } from "@/contexts/ActiveTargetContext";
import { SeverityBadge } from "@/components/Badges";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/report")({
  head: () => ({ meta: [{ title: "Report Builder — Kels.Ai" }] }),
  component: ReportBuilder,
});

type Target = { id: string; domain_url: string; testing_profile: string | null };
type Vuln = { id: string; title: string; severity: string | null; owasp_category: string | null; status: string | null; cvss_score: number | null; description: string | null; proof_of_concept: string | null; remediation: string | null };
type Prog = { in_scope_assets: string | null; out_of_scope_assets: string | null; program_name: string | null; platform: string | null };

function ReportBuilder() {
  const { target, setTarget } = useActiveTarget();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [vulns, setVulns] = useState<Vuln[] | null>(null);
  const [prog, setProg] = useState<Prog | null>(null);
  const [executive, setExecutive] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [edits, setEdits] = useState<Record<string, { description: string; proof_of_concept: string; remediation: string }>>({});

  useEffect(() => {
    supabase.from("targets").select("id,domain_url,testing_profile").then(({ data }) => {
      const ts = (data as Target[]) ?? [];
      setTargets(ts);
      if (!target && ts[0]) setTarget(ts[0]);
    });
  }, []);

  async function generate() {
    if (!target?.id) return;
    const [v, p] = await Promise.all([
      supabase.from("vulnerabilities").select("*").eq("target_id", target.id).order("severity"),
      supabase.from("program_configs").select("*").eq("target_id", target.id).maybeSingle(),
    ]);
    const vList = (v.data as Vuln[]) ?? [];
    setVulns(vList);
    setProg((p.data as Prog) ?? null);
    const counts = counters(vList);
    setExecutive(`Penetration test conducted against ${target.domain_url} on ${new Date().toLocaleDateString()}. ${vList.length} findings identified: ${counts.Critical} critical, ${counts.High} high, ${counts.Medium} medium, ${counts.Low} low. Overall risk rating: ${riskRating(counts)}.`);
    setEdits(Object.fromEntries(vList.map(x => [x.id, {
      description: x.description ?? "", proof_of_concept: x.proof_of_concept ?? "", remediation: x.remediation ?? "",
    }])));
    toast.success("Draft generated");
  }

  const counts = vulns ? counters(vulns) : { Critical: 0, High: 0, Medium: 0, Low: 0 };

  function markdown(): string {
    if (!target || !vulns) return "";
    let md = `# Penetration Test Report\n## ${target.domain_url}\n\n## Executive Summary\n${executive}\n\n## Scope & Methodology\n**Program:** ${prog?.program_name ?? "—"} (${prog?.platform ?? "—"})\n**Testing Profile:** ${target.testing_profile ?? "standard"}\n\n**In Scope:**\n${prog?.in_scope_assets ?? "—"}\n\n**Out of Scope:**\n${prog?.out_of_scope_assets ?? "—"}\n\n## Findings Summary\n| # | Title | Severity | OWASP | CVSS |\n|---|-------|----------|-------|------|\n`;
    vulns.forEach((v, i) => { md += `| ${i + 1} | ${v.title} | ${v.severity} | ${v.owasp_category} | ${v.cvss_score ?? "—"} |\n`; });
    md += `\n## Detailed Findings\n`;
    vulns.forEach((v, i) => {
      const e = edits[v.id] ?? { description: "", proof_of_concept: "", remediation: "" };
      md += `\n### ${i + 1}. ${v.title}\n**Severity:** ${v.severity} · **OWASP:** ${v.owasp_category} · **CVSS:** ${v.cvss_score ?? "—"}\n\n**Description**\n${e.description}\n\n**Proof of Concept**\n\`\`\`\n${e.proof_of_concept}\n\`\`\`\n\n**Remediation**\n${e.remediation}\n`;
    });
    md += `\n## Conclusion\n${conclusion}\n`;
    return md;
  }

  function exportPdf() {
    if (!target) return;
    const html = renderHtml(target, vulns ?? [], prog, executive, conclusion, edits, counts);
    const w = window.open("", "_blank");
    if (!w) { toast.error("Allow popups to export"); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  function copyMarkdown() { navigator.clipboard.writeText(markdown()); toast.success("Markdown copied"); }

  function copyBugcrowdTop() {
    if (!vulns || vulns.length === 0) return;
    const order = ["Critical","High","Medium","Low"];
    const top = [...vulns].sort((a, b) => order.indexOf(a.severity ?? "Low") - order.indexOf(b.severity ?? "Low"))[0];
    const e = edits[top.id] ?? { description: top.description ?? "", proof_of_concept: top.proof_of_concept ?? "", remediation: top.remediation ?? "" };
    const md = `**Title:** ${top.title}\n**Severity:** ${top.severity}\n**OWASP:** ${top.owasp_category}\n\n**Description**\n${e.description}\n\n**Steps to Reproduce**\n${e.proof_of_concept}\n\n**Remediation**\n${e.remediation}\n`;
    navigator.clipboard.writeText(md);
    toast.success("Top finding copied");
  }

  return (
    <div className="p-6 pb-24 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-glow-blue flex items-center gap-2"><ClipboardList className="h-6 w-6 text-[color:var(--primary)]" /> Report Builder</h1>
        <p className="text-sm text-muted-foreground">Draft a full penetration test report</p>
      </header>

      <div className="glass p-3 flex flex-wrap items-center gap-2">
        <Select value={target?.id ?? ""} onValueChange={(id) => { const t = targets?.find(x => x.id === id); if (t) setTarget(t); }}>
          <SelectTrigger className="w-[320px] font-mono text-xs"><SelectValue placeholder="Select target" /></SelectTrigger>
          <SelectContent>{(targets ?? []).map(t => <SelectItem key={t.id} value={t.id}>{t.domain_url}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={generate} className="bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90 text-white">Generate Draft Report</Button>
      </div>

      <section className="glass p-5">
        <h2 className="text-sm font-semibold mb-2">1. Executive Summary</h2>
        {target && (
          <div className="mb-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <Stat label="Target" value={target.domain_url} />
            <Stat label="Critical" value={String(counts.Critical)} color="var(--sev-critical)" />
            <Stat label="High" value={String(counts.High)} color="var(--sev-high)" />
            <Stat label="Medium" value={String(counts.Medium)} color="var(--sev-medium)" />
            <Stat label="Low" value={String(counts.Low)} color="var(--sev-low)" />
          </div>
        )}
        <Textarea rows={5} value={executive} onChange={e => setExecutive(e.target.value)} placeholder="Click Generate Draft Report to auto-fill, then edit." />
      </section>

      <section className="glass p-5">
        <h2 className="text-sm font-semibold mb-2">2. Scope & Methodology</h2>
        <div className="text-xs space-y-2">
          <div><span className="text-muted-foreground">Program:</span> {prog?.program_name ?? "—"} ({prog?.platform ?? "—"})</div>
          <div><span className="text-muted-foreground">Profile:</span> {target?.testing_profile ?? "standard"}</div>
          <div><span className="text-muted-foreground">In Scope:</span><pre className="font-mono mt-1 whitespace-pre-wrap">{prog?.in_scope_assets ?? "—"}</pre></div>
          <div><span className="text-muted-foreground">Out of Scope:</span><pre className="font-mono mt-1 whitespace-pre-wrap">{prog?.out_of_scope_assets ?? "—"}</pre></div>
        </div>
      </section>

      <section className="glass p-5">
        <h2 className="text-sm font-semibold mb-3">3. Findings Summary</h2>
        {vulns === null ? <Skeleton className="h-32" /> : vulns.length === 0 ? <div className="text-sm text-muted-foreground">Click Generate Draft Report.</div> : (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[color:var(--glass-border)] text-muted-foreground">
              <th className="text-left px-2 py-1.5">#</th><th className="text-left px-2 py-1.5">Title</th><th className="text-left px-2 py-1.5">Severity</th><th className="text-left px-2 py-1.5">OWASP</th><th className="text-left px-2 py-1.5">Status</th><th className="text-left px-2 py-1.5">CVSS</th>
            </tr></thead>
            <tbody>
              {vulns.map((v, i) => (
                <tr key={v.id} className="border-b border-[color:var(--glass-border)]">
                  <td className="px-2 py-1.5">{i + 1}</td>
                  <td className="px-2 py-1.5">{v.title}</td>
                  <td className="px-2 py-1.5"><SeverityBadge severity={v.severity ?? "Low"} /></td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{v.owasp_category}</td>
                  <td className="px-2 py-1.5">{v.status}</td>
                  <td className="px-2 py-1.5 font-mono">{v.cvss_score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">4. Detailed Findings</h2>
        {vulns?.map((v, i) => {
          const e = edits[v.id] ?? { description: v.description ?? "", proof_of_concept: v.proof_of_concept ?? "", remediation: v.remediation ?? "" };
          return (
            <article key={v.id} className="glass p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                <h3 className="font-semibold flex-1">{v.title}</h3>
                <SeverityBadge severity={v.severity ?? "Low"} />
                <span className="text-[10px] font-mono text-muted-foreground">{v.owasp_category}</span>
                <span className="text-xs">CVSS <span className="font-mono">{v.cvss_score ?? "—"}</span></span>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Description</div>
                <Textarea rows={3} value={e.description} onChange={ev => setEdits({ ...edits, [v.id]: { ...e, description: ev.target.value } })} />
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Proof of Concept</div>
                <Textarea rows={3} className="font-mono text-xs bg-[#0a0a0f]" value={e.proof_of_concept} onChange={ev => setEdits({ ...edits, [v.id]: { ...e, proof_of_concept: ev.target.value } })} />
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Remediation</div>
                <Textarea rows={2} value={e.remediation} onChange={ev => setEdits({ ...edits, [v.id]: { ...e, remediation: ev.target.value } })} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="glass p-5">
        <h2 className="text-sm font-semibold mb-2">5. Conclusion</h2>
        <Textarea rows={4} value={conclusion} onChange={e => setConclusion(e.target.value)} placeholder="Closing remarks…" />
      </section>

      <footer className="fixed bottom-0 left-[248px] right-0 z-20 border-t border-[color:var(--glass-border)] bg-background/80 backdrop-blur-md px-4 py-3 flex items-center justify-end gap-2">
        <Button onClick={exportPdf} className="bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90 text-white">
          <Download className="h-4 w-4 mr-1.5" /> Export as PDF
        </Button>
        <Button variant="secondary" onClick={copyMarkdown}><FileText className="h-4 w-4 mr-1.5" />Export as Markdown</Button>
        <Button variant="secondary" onClick={copyBugcrowdTop}><Copy className="h-4 w-4 mr-1.5" />Copy Bugcrowd Summary</Button>
      </footer>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

function counters(vs: Vuln[]) {
  const c = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<string, number>;
  vs.forEach(v => { if (v.severity && c[v.severity] !== undefined) c[v.severity]++; });
  return c;
}
function riskRating(c: Record<string, number>) {
  if (c.Critical > 0) return "Critical";
  if (c.High > 1) return "High";
  if (c.High > 0 || c.Medium > 2) return "Medium";
  if (c.Medium + c.Low > 0) return "Low";
  return "Informational";
}

function renderHtml(target: Target, vulns: Vuln[], prog: Prog | null, exec: string, conclusion: string, edits: Record<string, { description: string; proof_of_concept: string; remediation: string }>, counts: Record<string, number>) {
  const sevColor: Record<string, string> = { Critical: "#ef4444", High: "#f97316", Medium: "#f59e0b", Low: "#10b981" };
  const findings = vulns.map((v, i) => {
    const e = edits[v.id] ?? { description: v.description ?? "", proof_of_concept: v.proof_of_concept ?? "", remediation: v.remediation ?? "" };
    return `<section class="finding"><h3>${i + 1}. ${escape(v.title)}</h3>
      <div class="meta"><span class="badge" style="background:${sevColor[v.severity ?? "Low"]}1a;color:${sevColor[v.severity ?? "Low"]};border-color:${sevColor[v.severity ?? "Low"]}66">${v.severity}</span>
      <span class="mono">${escape(v.owasp_category ?? "")}</span><span>CVSS: <b>${v.cvss_score ?? "—"}</b></span></div>
      <h4>Description</h4><p>${escape(e.description)}</p>
      <h4>Proof of Concept</h4><pre>${escape(e.proof_of_concept)}</pre>
      <h4>Remediation</h4><p>${escape(e.remediation)}</p></section>`;
  }).join("");

  const rows = vulns.map((v, i) => `<tr><td>${i + 1}</td><td>${escape(v.title)}</td><td><span class="badge" style="background:${sevColor[v.severity ?? "Low"]}1a;color:${sevColor[v.severity ?? "Low"]}">${v.severity}</span></td><td class="mono">${escape(v.owasp_category ?? "")}</td><td>${v.cvss_score ?? "—"}</td></tr>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Kels.Ai Report — ${escape(target.domain_url)}</title>
<style>
@page { margin: 24mm 16mm; @bottom-right { content: counter(page) " / " counter(pages); color: #999; font-size: 10px; } }
body { background: #0a0a0f; color: #e7e9ee; font-family: 'Inter', sans-serif; padding: 20px; }
.brand { color: #3b82f6; font-weight: 800; font-size: 22px; text-shadow: 0 0 12px rgba(59,130,246,.6); }
.brand small { color: #999; font-weight: 400; font-size: 10px; display:block; }
h1, h2, h3 { color: #3b82f6; }
h2 { border-bottom: 1px solid #1f2230; padding-bottom: 4px; margin-top: 28px; }
h4 { color: #f59e0b; margin: 12px 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;}
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 6px 8px; border-bottom: 1px solid #1f2230; text-align: left; }
th { color: #999; font-weight: 500; }
.mono, pre { font-family: 'JetBrains Mono', monospace; }
pre { background: #14161e; border: 1px solid #1f2230; border-radius: 6px; padding: 10px; font-size: 11px; white-space: pre-wrap; color: #cfd3dc; }
.badge { display:inline-block; padding: 1px 6px; border-radius: 999px; border:1px solid; font-size: 10px; font-weight: 600; margin-right:6px; }
.meta { font-size: 11px; color: #999; margin: 6px 0 8px; }
.finding { page-break-inside: avoid; margin: 18px 0; padding: 12px; background: #0f1117; border: 1px solid #1f2230; border-radius: 8px;}
p { font-size: 12px; line-height: 1.5; }
</style></head><body>
<div class="brand">Kels.Ai<small>Autonomous Penetration Intelligence</small></div>
<h1>Penetration Test Report</h1>
<div class="mono" style="color:#999;font-size:12px;">${escape(target.domain_url)} — ${new Date().toLocaleDateString()}</div>
<h2>1. Executive Summary</h2><p>${escape(exec)}</p>
<div style="display:flex;gap:8px;margin:10px 0;">
  ${Object.entries(counts).map(([k,v]) => `<div style="flex:1;padding:8px;background:#0f1117;border:1px solid #1f2230;border-radius:6px;text-align:center;"><div style="font-size:10px;color:#999;text-transform:uppercase">${k}</div><div style="font-weight:800;color:${sevColor[k]}">${v}</div></div>`).join("")}
</div>
<h2>2. Scope &amp; Methodology</h2>
<p><b>Program:</b> ${escape(prog?.program_name ?? "—")} (${escape(prog?.platform ?? "—")})<br/>
<b>Profile:</b> ${escape(target.testing_profile ?? "standard")}</p>
<h4>In Scope</h4><pre>${escape(prog?.in_scope_assets ?? "")}</pre>
<h4>Out of Scope</h4><pre>${escape(prog?.out_of_scope_assets ?? "")}</pre>
<h2>3. Findings Summary</h2>
<table><thead><tr><th>#</th><th>Title</th><th>Severity</th><th>OWASP</th><th>CVSS</th></tr></thead><tbody>${rows}</tbody></table>
<h2>4. Detailed Findings</h2>${findings}
<h2>5. Conclusion</h2><p>${escape(conclusion)}</p>
</body></html>`;
}

function escape(s: string) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}