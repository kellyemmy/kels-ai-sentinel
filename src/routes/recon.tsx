import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Radar, Rocket } from "lucide-react";
import { useActiveTarget } from "@/contexts/ActiveTargetContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/recon")({
  head: () => ({ meta: [{ title: "Recon Lab — Kels.Ai" }] }),
  component: ReconLab,
});

type Target = { id: string; domain_url: string };
type SD = { id: string; subdomain_url: string | null; status_code: number | null; ip_address: string | null; technologies: string | null; open_ports: string | null; in_scope: boolean | null };
type JS = { id: string; js_file_url: string | null; extracted_endpoints: string | null; secrets_found: boolean | null; secrets_detail: string | null; file_size_kb: number | null };
type Tech = { id: string; technology_name: string | null; version: string | null; category: string | null; known_vulnerable: boolean | null; cve_reference: string | null };

function ReconLab() {
  const { target, setTarget } = useActiveTarget();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [subs, setSubs] = useState<SD[] | null>(null);
  const [jsFiles, setJsFiles] = useState<JS[] | null>(null);
  const [techs, setTechs] = useState<Tech[] | null>(null);
  const [openJs, setOpenJs] = useState<JS | null>(null);

  useEffect(() => {
    supabase.from("targets").select("id,domain_url").then(({ data }) => {
      const ts = (data as Target[]) ?? [];
      setTargets(ts);
      if (!target && ts[0]) setTarget(ts[0]);
    });
  }, []);

  async function loadAll() {
    if (!target?.id) return;
    const [s, j, t] = await Promise.all([
      supabase.from("subdomains").select("*").eq("target_id", target.id).order("discovered_at", { ascending: false }),
      supabase.from("js_intelligence").select("*").eq("target_id", target.id).order("discovered_at", { ascending: false }),
      supabase.from("tech_fingerprints").select("*").eq("target_id", target.id).order("discovered_at", { ascending: false }),
    ]);
    setSubs((s.data as SD[]) ?? []);
    setJsFiles((j.data as JS[]) ?? []);
    setTechs((t.data as Tech[]) ?? []);
  }

  useEffect(() => {
    if (!target?.id) return;
    setSubs(null); setJsFiles(null); setTechs(null);
    loadAll();
    const ch = supabase.channel(`recon-${target.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subdomains" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "js_intelligence" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "tech_fingerprints" }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [target?.id]);

  async function launchSub(s: SD) {
    if (!s.subdomain_url) return;
    const { error } = await supabase.from("targets").insert({ domain_url: s.subdomain_url, status: "scanning", testing_profile: "standard" });
    if (error) toast.error(error.message);
    else toast.success(`Scan launched: ${s.subdomain_url}`);
  }

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-glow-blue flex items-center gap-2"><Radar className="h-6 w-6 text-[color:var(--primary)]" /> Recon Lab</h1>
        <p className="text-sm text-muted-foreground">Passive reconnaissance dashboard</p>
      </header>

      <div className="glass p-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Target</span>
        <Select value={target?.id ?? ""} onValueChange={(id) => { const t = targets?.find(x => x.id === id); if (t) setTarget(t); }}>
          <SelectTrigger className="w-[320px] font-mono text-xs"><SelectValue placeholder="Select target" /></SelectTrigger>
          <SelectContent>{(targets ?? []).map(t => <SelectItem key={t.id} value={t.id}>{t.domain_url}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <section className="glass p-4">
        <h2 className="text-sm font-semibold mb-3">Subdomain Map</h2>
        {subs === null ? <Skeleton className="h-32" /> : subs.length === 0 ? <Empty text="No subdomains discovered yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-[color:var(--glass-border)]">
                  <Th>Subdomain</Th><Th>Status</Th><Th>IP</Th><Th>Tech</Th><Th>Ports</Th><Th>Scope</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id} className="border-b border-[color:var(--glass-border)] hover:bg-white/[0.03]">
                    <Td><span className="font-mono">{s.subdomain_url}</span></Td>
                    <Td>{s.status_code}</Td>
                    <Td><span className="font-mono">{s.ip_address}</span></Td>
                    <Td>{s.technologies}</Td>
                    <Td><span className="font-mono">{s.open_ports}</span></Td>
                    <Td>{s.in_scope
                      ? <span className="rounded bg-[color:var(--success)]/15 text-[color:var(--success)] px-1.5 py-0.5">yes</span>
                      : <span className="rounded bg-[color:var(--danger)]/15 text-[color:var(--danger)] px-1.5 py-0.5">no</span>}
                    </Td>
                    <Td><Button size="sm" variant="secondary" onClick={() => launchSub(s)}><Rocket className="h-3 w-3 mr-1" />Scan</Button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass p-4">
        <h2 className="text-sm font-semibold mb-3">JavaScript Intelligence</h2>
        {jsFiles === null ? <Skeleton className="h-32" /> : jsFiles.length === 0 ? <Empty text="No JS files analyzed yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-[color:var(--glass-border)]"><Th>File</Th><Th>Endpoints</Th><Th>Secrets</Th><Th>Size</Th></tr>
              </thead>
              <tbody>
                {jsFiles.map(j => (
                  <tr key={j.id} onClick={() => setOpenJs(j)} className="cursor-pointer border-b border-[color:var(--glass-border)] hover:bg-white/[0.03]">
                    <Td><span className="font-mono">{j.js_file_url}</span></Td>
                    <Td>{(j.extracted_endpoints ?? "").split(/\n/).filter(Boolean).length}</Td>
                    <Td>{j.secrets_found
                      ? <span className="rounded bg-[color:var(--danger)]/15 text-[color:var(--danger)] px-1.5 py-0.5">yes</span>
                      : <span className="text-muted-foreground">no</span>}
                    </Td>
                    <Td>{j.file_size_kb} KB</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass p-4">
        <h2 className="text-sm font-semibold mb-3">Technology Stack Fingerprint</h2>
        {techs === null ? <Skeleton className="h-24" /> : techs.length === 0 ? <Empty text="No technologies fingerprinted." /> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {techs.map(t => {
              const color = t.known_vulnerable ? "var(--danger)" : !t.version ? "var(--gold)" : "var(--success)";
              return (
                <div key={t.id} className="glass p-3 border" style={{ borderColor: `${color}66` }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{t.technology_name}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{t.category}</span>
                  </div>
                  <div className="font-mono text-xs mt-1" style={{ color }}>{t.version ?? "unknown"}</div>
                  {t.cve_reference && <div className="mt-1 text-[10px] font-mono text-[color:var(--danger)]">{t.cve_reference}</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Sheet open={!!openJs} onOpenChange={(v) => !v && setOpenJs(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle className="text-left font-mono text-sm break-all">{openJs?.js_file_url}</SheetTitle></SheetHeader>
          {openJs && (
            <div className="space-y-4 mt-3">
              <section>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Extracted Endpoints</h3>
                <pre className="rounded-md border border-[color:var(--glass-border)] bg-[#0a0a0f] p-3 font-mono text-[11px] whitespace-pre-wrap">{openJs.extracted_endpoints ?? "(none)"}</pre>
              </section>
              {openJs.secrets_found && (
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-[color:var(--danger)] mb-1">Secrets Found</h3>
                  <pre className="rounded-md border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 p-3 font-mono text-[11px] whitespace-pre-wrap text-[color:var(--danger)]">{openJs.secrets_detail}</pre>
                </section>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-medium px-2 py-1.5 uppercase tracking-wider text-[10px]">{children}</th>;
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-2 py-1.5">{children}</td>;
}
function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}