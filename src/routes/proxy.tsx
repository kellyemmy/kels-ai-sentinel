import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flag, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MethodBadge, StatusCodeBadge } from "@/components/Badges";
import { Skeleton } from "@/components/ui/skeleton";
import { setStudioPreload } from "@/lib/studio-bus";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/proxy")({
  head: () => ({ meta: [{ title: "Live Intercept Proxy — Kels.Ai" }] }),
  component: Proxy,
});

type Req = {
  id: string; target_id: string | null; method: string | null; url: string | null;
  headers: any; body: string | null; response_status: number | null;
  response_headers: any; response_body: string | null;
  timestamp: string; flagged: boolean; flag_note: string | null;
};
type Target = { id: string; domain_url: string };

function Proxy() {
  const navigate = useNavigate();
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState<string>("all");
  const [methodF, setMethodF] = useState("ALL");
  const [statusF, setStatusF] = useState("ALL");
  const [search, setSearch] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [items, setItems] = useState<Req[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("targets").select("id, domain_url").then(({ data }) => setTargets((data ?? []) as Target[]));
  }, []);

  async function load() {
    let q = supabase.from("intercepted_requests").select("*").order("timestamp", { ascending: false }).limit(500);
    if (targetId !== "all") q = q.eq("target_id", targetId);
    const { data } = await q;
    setItems((data ?? []) as Req[]);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("ireq-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "intercepted_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  const filtered = useMemo(() => {
    if (!items) return null;
    return items.filter((r) => {
      if (methodF !== "ALL" && (r.method ?? "").toUpperCase() !== methodF) return false;
      if (statusF !== "ALL") {
        const code = r.response_status ?? 0;
        const bucket = `${Math.floor(code / 100)}xx`;
        if (bucket !== statusF) return false;
      }
      if (flaggedOnly && !r.flagged) return false;
      if (search && !(r.url ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, methodF, statusF, search, flaggedOnly]);

  const selected = filtered?.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow-blue">Live Intercept Proxy</h1>
          <p className="text-sm text-muted-foreground">Read-only viewer of HTTP traffic captured by the local proxy agent</p>
        </div>
      </header>

      <div className="glass p-3 flex flex-wrap gap-2 items-center">
        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="All targets" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All targets</SelectItem>
            {targets.map((t) => <SelectItem key={t.id} value={t.id}>{t.domain_url}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={methodF} onValueChange={setMethodF}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["ALL","GET","POST","PUT","PATCH","DELETE"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["ALL","2xx","3xx","4xx","5xx"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Search URL…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[260px] font-mono" />
        <label className="flex items-center gap-2 text-xs ml-auto">
          <Switch checked={flaggedOnly} onCheckedChange={setFlaggedOnly} /> Show flagged only
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-4 min-h-[480px]">
        <section className="glass overflow-hidden">
          <div className="max-h-[640px] overflow-y-auto divide-y divide-[color:var(--glass-border)]">
            {filtered === null && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 m-2" />)}
            {filtered && filtered.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No traffic intercepted yet. Start a scan or connect your proxy.
              </div>
            )}
            {filtered?.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors",
                  selectedId === r.id && "bg-[color:var(--primary)]/10",
                )}
              >
                <MethodBadge method={r.method ?? "GET"} />
                <span className="font-mono text-xs text-foreground/90 truncate flex-1">{r.url}</span>
                <StatusCodeBadge code={r.response_status ?? undefined} />
                {r.flagged && <Flag className="h-3.5 w-3.5 text-[color:var(--gold)]" />}
                <span className="font-mono text-[10px] text-muted-foreground">{new Date(r.timestamp).toLocaleTimeString()}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="glass p-4">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a request to inspect.
            </div>
          ) : (
            <Tabs defaultValue="request">
              <TabsList>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
                <TabsTrigger value="studio">Send to Studio</TabsTrigger>
                <TabsTrigger value="flag">Flag</TabsTrigger>
              </TabsList>

              <TabsContent value="request" className="space-y-3 pt-3">
                <div className="flex items-center gap-2">
                  <MethodBadge method={selected.method ?? "GET"} />
                  <span className="font-mono text-xs break-all">{selected.url}</span>
                </div>
                <CodeBlock title="Headers" code={prettyJson(selected.headers)} />
                <CodeBlock title="Body" code={selected.body || "(empty)"} />
              </TabsContent>

              <TabsContent value="response" className="space-y-3 pt-3">
                <StatusCodeBadge code={selected.response_status ?? undefined} />
                <CodeBlock title="Headers" code={prettyJson(selected.response_headers)} />
                <CodeBlock title="Body" code={selected.response_body || "(empty)"} />
              </TabsContent>

              <TabsContent value="studio" className="pt-3 space-y-3">
                <p className="text-sm text-muted-foreground">Pre-populate the API Testing Studio with this exact request.</p>
                <Button onClick={() => {
                  setStudioPreload({
                    method: selected.method ?? "GET",
                    url: selected.url ?? "",
                    headers: (selected.headers && typeof selected.headers === "object") ? selected.headers : {},
                    body: selected.body ?? "",
                  });
                  navigate({ to: "/studio" });
                }}>
                  <Send className="h-4 w-4 mr-2" /> Open in Studio
                </Button>
              </TabsContent>

              <TabsContent value="flag" className="pt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={selected.flagged}
                    onCheckedChange={async (v) => {
                      await supabase.from("intercepted_requests").update({ flagged: v }).eq("id", selected.id);
                    }}
                  />
                  Flag this request
                </label>
                <Textarea
                  placeholder="Note…"
                  defaultValue={selected.flag_note ?? ""}
                  onBlur={async (e) => {
                    await supabase.from("intercepted_requests").update({ flag_note: e.target.value }).eq("id", selected.id);
                    toast.success("Flag updated");
                  }}
                />
              </TabsContent>
            </Tabs>
          )}
        </section>
      </div>
    </div>
  );
}

function prettyJson(v: any) {
  if (v == null) return "(none)";
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <pre className="max-h-[200px] overflow-auto rounded-md border border-[color:var(--glass-border)] bg-[#0a0a0f] p-2 font-mono text-[11px] whitespace-pre-wrap break-all">{code}</pre>
    </div>
  );
}