import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, Plus, X, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MethodBadge, StatusCodeBadge } from "@/components/Badges";
import { takeStudioPreload } from "@/lib/studio-bus";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadForm, saveForm } from "@/lib/agent-config";

export const Route = createFileRoute("/studio")({
  head: () => ({ meta: [{ title: "API Testing Studio — Kels.Ai" }] }),
  component: Studio,
});

const METHODS = ["GET","POST","PUT","PATCH","DELETE","OPTIONS","HEAD"] as const;
type Kv = { key: string; value: string };

type StudioState = {
  method: string;
  url: string;
  params: Kv[];
  headers: Kv[];
  bodyMode: "json" | "form" | "graphql" | "xml";
  body: string;
  gqlQuery: string;
  gqlVars: string;
  authType: "none" | "bearer" | "basic" | "apikey";
  authToken: string;
  authUser: string;
  authPass: string;
  apiKeyName: string;
  apiKeyValue: string;
};

const DEFAULT: StudioState = {
  method: "GET", url: "", params: [], headers: [],
  bodyMode: "json", body: "{\n  \n}", gqlQuery: "", gqlVars: "{}",
  authType: "none", authToken: "", authUser: "", authPass: "",
  apiKeyName: "X-API-Key", apiKeyValue: "",
};

type HistoryEntry = { id: string; method: string; url: string; status: number | null; ms: number; at: number };
type ResponseShape = { status: number; headers: Record<string,string>; body: string; ms: number; size: number };

function Studio() {
  const [s, setS] = useState<StudioState>(() => loadForm("kelsai.studio", DEFAULT));
  const [banner, setBanner] = useState(true);
  const [resp, setResp] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadForm<HistoryEntry[]>("kelsai.studio.history", []) as any);

  // Apply preload from proxy
  useEffect(() => {
    const pre = takeStudioPreload();
    if (pre) {
      setS((cur) => ({
        ...cur,
        method: pre.method.toUpperCase(),
        url: pre.url,
        headers: Object.entries(pre.headers ?? {}).map(([key, value]) => ({ key, value: String(value) })),
        body: pre.body ?? cur.body,
      }));
      toast.success("Loaded from proxy");
    }
  }, []);

  useEffect(() => { saveForm("kelsai.studio", s); }, [s]);
  useEffect(() => { saveForm("kelsai.studio.history", history); }, [history]);

  async function send() {
    if (!s.url) { toast.error("URL required"); return; }
    setLoading(true);
    const start = performance.now();
    try {
      // build URL with params
      const u = new URL(s.url);
      s.params.filter((p) => p.key).forEach((p) => u.searchParams.append(p.key, p.value));

      // build headers
      const headers: Record<string, string> = {};
      s.headers.filter((h) => h.key).forEach((h) => { headers[h.key] = h.value; });
      if (s.authType === "bearer" && s.authToken) headers["Authorization"] = `Bearer ${s.authToken}`;
      if (s.authType === "basic" && (s.authUser || s.authPass)) headers["Authorization"] = `Basic ${btoa(`${s.authUser}:${s.authPass}`)}`;
      if (s.authType === "apikey" && s.apiKeyName) headers[s.apiKeyName] = s.apiKeyValue;

      let body: BodyInit | undefined;
      if (!["GET","HEAD"].includes(s.method)) {
        if (s.bodyMode === "graphql") {
          headers["Content-Type"] ??= "application/json";
          body = JSON.stringify({ query: s.gqlQuery, variables: safeJson(s.gqlVars) });
        } else if (s.bodyMode === "form") {
          const f = new URLSearchParams();
          try { Object.entries(JSON.parse(s.body || "{}")).forEach(([k, v]) => f.append(k, String(v))); } catch {}
          body = f;
        } else {
          body = s.body;
        }
      }
      const res = await fetch(u.toString(), { method: s.method, headers, body });
      const text = await res.text();
      const respHeaders: Record<string,string> = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });
      const ms = Math.round(performance.now() - start);
      const out: ResponseShape = { status: res.status, headers: respHeaders, body: text, ms, size: new Blob([text]).size };
      setResp(out);
      setHistory((h) => [{ id: crypto.randomUUID(), method: s.method, url: u.toString(), status: res.status, ms, at: Date.now() }, ...h].slice(0, 40));
    } catch (e: any) {
      const ms = Math.round(performance.now() - start);
      setResp({ status: 0, headers: {}, body: String(e?.message ?? e), ms, size: 0 });
      toast.error("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-glow-blue">API Testing Studio</h1>
        <p className="text-sm text-muted-foreground">Manual HTTP request runner for API pentesting</p>
      </header>

      {banner && (
        <Alert className="border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5 text-[color:var(--gold)]">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>Direct browser requests bypass the local proxy. For full traffic interception, route requests through the Kels.Ai agent backend.</span>
            <button onClick={() => setBanner(false)}><X className="h-4 w-4" /></button>
          </AlertDescription>
        </Alert>
      )}

      <div className="glass p-3 flex items-center gap-2">
        <Select value={s.method} onValueChange={(v) => setS({ ...s, method: v })}>
          <SelectTrigger className="w-[120px]"><MethodBadge method={s.method} /></SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => <SelectItem key={m} value={m}><MethodBadge method={m} /></SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          value={s.url}
          onChange={(e) => setS({ ...s, url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className="font-mono flex-1"
        />
        <Button onClick={send} disabled={loading} className="bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90 text-white">
          <Play className="h-4 w-4 mr-1.5" /> Send
        </Button>
      </div>

      <Tabs defaultValue="params" className="glass p-3">
        <TabsList>
          <TabsTrigger value="params">Params</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="auth">Auth</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="pt-3">
          <KvEditor rows={s.params} onChange={(rows) => setS({ ...s, params: rows })} />
        </TabsContent>

        <TabsContent value="headers" className="pt-3 space-y-2">
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setS({ ...s, headers: [...s.headers, { key: "Content-Type", value: "application/json" }] })}>+ Content-Type</Button>
            <Button size="sm" variant="secondary" onClick={() => setS({ ...s, headers: [...s.headers, { key: "Authorization", value: "Bearer " }] })}>+ Authorization</Button>
          </div>
          <KvEditor rows={s.headers} onChange={(rows) => setS({ ...s, headers: rows })} />
        </TabsContent>

        <TabsContent value="body" className="pt-3 space-y-3">
          <div className="flex gap-1">
            {(["json","form","graphql","xml"] as const).map((m) => (
              <Button key={m} variant={s.bodyMode === m ? "default" : "secondary"} size="sm" onClick={() => setS({ ...s, bodyMode: m })}>
                {m === "json" ? "Raw JSON" : m === "form" ? "Form Data" : m === "graphql" ? "GraphQL" : "XML"}
              </Button>
            ))}
          </div>
          {s.bodyMode === "graphql" ? (
            <div className="grid grid-cols-2 gap-2">
              <Textarea value={s.gqlQuery} onChange={(e) => setS({ ...s, gqlQuery: e.target.value })} placeholder="query { ... }" className="font-mono h-40" />
              <Textarea value={s.gqlVars} onChange={(e) => setS({ ...s, gqlVars: e.target.value })} placeholder="{ }" className="font-mono h-40" />
            </div>
          ) : (
            <Textarea value={s.body} onChange={(e) => setS({ ...s, body: e.target.value })} className="font-mono h-40" />
          )}
        </TabsContent>

        <TabsContent value="auth" className="pt-3 space-y-2">
          <Select value={s.authType} onValueChange={(v: any) => setS({ ...s, authType: v })}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="basic">Basic Auth</SelectItem>
              <SelectItem value="apikey">API Key</SelectItem>
            </SelectContent>
          </Select>
          {s.authType === "bearer" && <Input value={s.authToken} onChange={(e) => setS({ ...s, authToken: e.target.value })} placeholder="token" className="font-mono" />}
          {s.authType === "basic" && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="user" value={s.authUser} onChange={(e) => setS({ ...s, authUser: e.target.value })} />
              <Input placeholder="pass" type="password" value={s.authPass} onChange={(e) => setS({ ...s, authPass: e.target.value })} />
            </div>
          )}
          {s.authType === "apikey" && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Header name" value={s.apiKeyName} onChange={(e) => setS({ ...s, apiKeyName: e.target.value })} />
              <Input placeholder="Value" value={s.apiKeyValue} onChange={(e) => setS({ ...s, apiKeyValue: e.target.value })} className="font-mono" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="pt-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <div className="space-y-1.5">
              {history.map((h) => (
                <button
                  key={h.id}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] hover:bg-white/[0.05]"
                  onClick={() => setS({ ...s, method: h.method, url: h.url })}
                >
                  <MethodBadge method={h.method} />
                  <span className="font-mono text-xs truncate flex-1">{h.url}</span>
                  <StatusCodeBadge code={h.status ?? undefined} />
                  <span className="font-mono text-[10px] text-muted-foreground">{h.ms}ms</span>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {resp && <ResponsePanel resp={resp} state={s} onSaveCase={async () => {
        const { data: targets } = await supabase.from("targets").select("id").limit(1);
        const target_id = targets?.[0]?.id;
        if (!target_id) { toast.error("No target available"); return; }
        await supabase.from("intercepted_requests").insert({
          target_id,
          method: "MANUAL",
          url: s.url,
          headers: Object.fromEntries(s.headers.filter((h) => h.key).map((h) => [h.key, h.value])),
          body: s.body,
          response_status: resp.status,
          response_headers: resp.headers,
          response_body: resp.body,
        });
        toast.success("Saved as test case");
      }} />}
    </div>
  );
}

function KvEditor({ rows, onChange }: { rows: Kv[]; onChange: (r: Kv[]) => void }) {
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-1.5">
          <Input placeholder="key" value={r.key} onChange={(e) => { const c = [...rows]; c[i] = { ...r, key: e.target.value }; onChange(c); }} className="font-mono" />
          <Input placeholder="value" value={r.value} onChange={(e) => { const c = [...rows]; c[i] = { ...r, value: e.target.value }; onChange(c); }} className="font-mono" />
          <Button size="icon" variant="ghost" onClick={() => onChange(rows.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange([...rows, { key: "", value: "" }])}><Plus className="h-3.5 w-3.5 mr-1" /> Add row</Button>
    </div>
  );
}

function ResponsePanel({ resp, state, onSaveCase }: { resp: ResponseShape; state: StudioState; onSaveCase: () => void }) {
  return (
    <section className="glass p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <StatusCodeBadge code={resp.status || undefined} />
        <span className="text-xs text-muted-foreground">{resp.ms}ms · {(resp.size / 1024).toFixed(2)} KB</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(resp.body); toast.success("Copied response"); }}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copy
          </Button>
          <Button size="sm" variant="secondary" onClick={onSaveCase}>Save as Test Case</Button>
          <Button size="sm" variant="secondary" onClick={() => toast.info("Open Vulnerability Tracker to add this finding (auto-open coming soon)")}>Send to Vulnerability Tracker</Button>
        </div>
      </div>
      <Tabs defaultValue="body">
        <TabsList>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="cookies">Cookies</TabsTrigger>
        </TabsList>
        <TabsContent value="body" className="pt-2">
          <pre className="max-h-[320px] overflow-auto rounded-md border border-[color:var(--glass-border)] bg-[#0a0a0f] p-3 font-mono text-[11px] whitespace-pre-wrap">{resp.body}</pre>
        </TabsContent>
        <TabsContent value="headers" className="pt-2">
          <pre className="rounded-md border border-[color:var(--glass-border)] bg-[#0a0a0f] p-3 font-mono text-[11px]">{JSON.stringify(resp.headers, null, 2)}</pre>
        </TabsContent>
        <TabsContent value="cookies" className="pt-2">
          <pre className="rounded-md border border-[color:var(--glass-border)] bg-[#0a0a0f] p-3 font-mono text-[11px]">{resp.headers["set-cookie"] ?? "(none)"}</pre>
        </TabsContent>
      </Tabs>
      {/* state used to support future "send to vuln tracker" prefill */}
      <input type="hidden" value={state.url} readOnly />
    </section>
  );
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}