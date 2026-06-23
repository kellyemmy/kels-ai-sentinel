import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Crosshair, Activity, ShieldAlert, AlertOctagon, Shield, Radar, FileText, ScrollText, Rocket, CheckCircle2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { AgentBadge } from "@/components/Badges";
import { OWASP_CATEGORIES, SEVERITIES } from "@/lib/owasp";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Kels.Ai" }] }),
  component: Dashboard,
});

type AgentLog = {
  id: string;
  agent_name: string | null;
  log_message: string | null;
  step_status: string | null;
  timestamp: string;
};

function Dashboard() {
  const [stats, setStats] = useState<{ targets: number; scanning: number; vulns: number; critical: number } | null>(null);
  const [extra, setExtra] = useState<{ programs: number; subs: number; jsFiles: number; notes: number } | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [sevData, setSevData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [owaspData, setOwaspData] = useState<{ name: string; value: number }[]>([]);
  const [logs, setLogs] = useState<AgentLog[] | null>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const pausedScrollRef = useRef(false);

  async function loadAll() {
    const [tRes, vRes, lRes, pcRes, sdRes, jiRes, noRes, tList, vList] = await Promise.all([
      supabase.from("targets").select("status"),
      supabase.from("vulnerabilities").select("severity, owasp_category"),
      supabase.from("agent_logs").select("*").order("timestamp", { ascending: false }).limit(50),
      supabase.from("program_configs").select("id", { count: "exact", head: true }),
      supabase.from("subdomains").select("id", { count: "exact", head: true }),
      supabase.from("js_intelligence").select("id", { count: "exact", head: true }),
      supabase.from("notes").select("id, target_id, title, created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("targets").select("id, domain_url, created_at, status").order("created_at", { ascending: false }).limit(20),
      supabase.from("vulnerabilities").select("id, title, severity, target_id, discovered_at").order("discovered_at", { ascending: false }).limit(20),
    ]);
    const targets = tRes.data ?? [];
    const vulns = vRes.data ?? [];
    setStats({
      targets: targets.length,
      scanning: targets.filter((t) => t.status === "scanning").length,
      vulns: vulns.length,
      critical: vulns.filter((v) => v.severity === "Critical").length,
    });
    setExtra({
      programs: pcRes.count ?? 0,
      subs: sdRes.count ?? 0,
      jsFiles: jiRes.count ?? 0,
      notes: (noRes.data ?? []).length,
    });
    const sevColors: Record<string, string> = {
      Low: "var(--sev-low)", Medium: "var(--sev-medium)",
      High: "var(--sev-high)", Critical: "var(--sev-critical)",
    };
    setSevData(SEVERITIES.map((s) => ({
      name: s,
      value: vulns.filter((v) => v.severity === s).length,
      color: sevColors[s],
    })));
    setOwaspData(OWASP_CATEGORIES.map((c) => ({
      name: c.split(" ")[0],
      value: vulns.filter((v) => v.owasp_category === c).length,
    })).filter((x) => x.value > 0));
    setLogs(((lRes.data ?? []) as AgentLog[]).reverse());

    const targetMap = new Map<string, string>();
    ((tList.data ?? []) as any[]).forEach((t) => targetMap.set(t.id, t.domain_url));
    const items: FeedItem[] = [];
    ((tList.data ?? []) as any[]).forEach((t) => {
      items.push({ kind: "target", at: t.created_at, target: t.domain_url, text: "New target added", to: "/targets" });
      if (t.status === "scanning") items.push({ kind: "scan", at: t.created_at, target: t.domain_url, text: "Scan launched", to: "/targets" });
    });
    ((vList.data ?? []) as any[]).forEach((v) => {
      const sev = v.severity ?? "Low";
      if (sev === "Critical" || sev === "High")
        items.push({ kind: sev === "Critical" ? "vulnCritical" : "vulnHigh", at: v.discovered_at, target: targetMap.get(v.target_id) ?? "—", text: `${sev}: ${v.title}`, to: `/vulnerabilities?open=${v.id}` });
    });
    ((noRes.data ?? []) as any[]).forEach((n) => {
      items.push({ kind: "note", at: n.created_at, target: targetMap.get(n.target_id) ?? "—", text: `Note: ${n.title}`, to: "/notes" });
    });
    setFeed(items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 20));
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("dashboard-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_logs" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setLogs((cur) => [...(cur ?? []), payload.new as AgentLog].slice(-200));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vulnerabilities" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "targets" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "subdomains" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "js_intelligence" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const el = logScrollRef.current;
    if (!el || pausedScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  function onScroll() {
    const el = logScrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    pausedScrollRef.current = !atBottom;
  }

  const owaspColors = ["var(--sev-critical)","var(--sev-high)","var(--sev-medium)","var(--primary)","var(--success)","var(--agent-planner)","var(--agent-reporter)","var(--agent-fuzzer)","var(--gold)","var(--danger)"];

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-glow-blue">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time autonomous agent intelligence</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Targets" value={stats?.targets} icon={<Crosshair className="h-4 w-4 text-[color:var(--primary)]" />} accent="primary" />
        <StatCard
          label="Active Scans"
          value={stats?.scanning}
          icon={<Activity className="h-4 w-4 text-[color:var(--success)]" />}
          accent="success"
          indicator={(stats?.scanning ?? 0) > 0 ? <span className="h-2 w-2 rounded-full bg-[color:var(--success)] pulse-dot" /> : null}
        />
        <StatCard label="Vulnerabilities Found" value={stats?.vulns} icon={<ShieldAlert className="h-4 w-4 text-[color:var(--gold)]" />} accent="gold" />
        <StatCard
          label="Critical Findings"
          value={stats?.critical}
          icon={<AlertOctagon className="h-4 w-4 text-[color:var(--danger)]" />}
          accent="danger"
          glow={(stats?.critical ?? 0) > 0}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Programs in Scope" value={extra?.programs} icon={<Shield className="h-3.5 w-3.5" />} />
        <MiniStat label="Subdomains Discovered" value={extra?.subs} icon={<Radar className="h-3.5 w-3.5" />} />
        <MiniStat label="JS Files Analyzed" value={extra?.jsFiles} icon={<ScrollText className="h-3.5 w-3.5" />} />
        <MiniStat label="Notes Written" value={extra?.notes} icon={<FileText className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_30%] gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Vulnerabilities by Severity">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sevData}>
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0f1117", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {sevData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Findings by OWASP Category">
          <div className="h-[260px]">
            {owaspData.length === 0 ? (
              <EmptyState text="No categorized findings yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={owaspData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {owaspData.map((_, i) => <Cell key={i} fill={owaspColors[i % owaspColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f1117", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
        </div>
        <ActivityFeed feed={feed} />
      </div>

      <Panel title="Agent Thought Stream">
        <div
          ref={logScrollRef}
          onScroll={onScroll}
          className="scanlines relative h-[300px] overflow-y-auto rounded-md bg-[#0a0a0f] border border-[color:var(--glass-border)] p-3 font-mono text-xs"
        >
          {logs === null && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>}
          {logs && logs.length === 0 && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <span>Awaiting agent initialization<span className="blink">▍</span></span>
            </div>
          )}
          {logs?.map((l) => (
            <div key={l.id} className="slide-in-up flex items-start gap-2 py-0.5">
              <span className="text-muted-foreground">{new Date(l.timestamp).toLocaleTimeString()}</span>
              <AgentBadge name={l.agent_name} />
              <span className="text-foreground/90">{l.log_message}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function StatCard({ label, value, icon, accent, indicator, glow }: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  accent: "primary" | "success" | "gold" | "danger";
  indicator?: React.ReactNode;
  glow?: boolean;
}) {
  const accentClass: Record<string, string> = {
    primary: "text-[color:var(--primary)]",
    success: "text-[color:var(--success)]",
    gold: "text-[color:var(--gold)]",
    danger: "text-[color:var(--danger)]",
  };
  return (
    <div className={`glass p-4 ${glow ? "glow-red" : ""}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-wider">{label}</span>
        <span className="flex items-center gap-1.5">{indicator}{icon}</span>
      </div>
      <div className={`mt-2 text-3xl font-semibold ${accentClass[accent]}`}>
        {value === undefined ? <Skeleton className="h-8 w-12" /> : value}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground/90">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{text}</div>;
}
