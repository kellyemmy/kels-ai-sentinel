import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveTarget } from "@/contexts/ActiveTargetContext";
import type { ReactNode } from "react";

type AuthSession = {
  id: string;
  target_id: string | null;
  session_name: string;
  auth_type: "cookie" | "bearer" | "basic" | "custom";
  session_data: any;
  is_active: boolean;
  last_used: string | null;
  created_at: string;
};

export function SessionManager({ trigger }: { trigger: ReactNode }) {
  const { target } = useActiveTarget();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<AuthSession[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<AuthSession["auth_type"]>("cookie");
  const [data, setData] = useState<Record<string, string>>({ cookie: "", token: "", username: "", password: "", header: "", value: "" });

  async function load() {
    if (!target) { setList([]); return; }
    const { data: rows } = await supabase.from("auth_sessions").select("*").eq("target_id", target.id).order("created_at", { ascending: false });
    setList((rows ?? []) as AuthSession[]);
  }
  useEffect(() => { if (open) load(); }, [open, target?.id]);

  async function save() {
    if (!target) { toast.error("Pick an active target first"); return; }
    if (!name.trim()) { toast.error("Name required"); return; }
    const payload: any = {};
    if (type === "cookie") payload.cookie = data.cookie;
    if (type === "bearer") payload.token = data.token;
    if (type === "basic") { payload.username = data.username; payload.password = data.password; }
    if (type === "custom") { payload.header = data.header; payload.value = data.value; }
    const { error } = await supabase.from("auth_sessions").insert({
      target_id: target.id, session_name: name.trim(), auth_type: type, session_data: payload,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Session saved");
    setName(""); setData({ cookie: "", token: "", username: "", password: "", header: "", value: "" });
    load();
  }

  async function setActive(s: AuthSession) {
    if (!target) return;
    await supabase.from("auth_sessions").update({ is_active: false }).eq("target_id", target.id);
    await supabase.from("auth_sessions").update({ is_active: true, last_used: new Date().toISOString() }).eq("id", s.id);
    load();
  }

  async function testSession(s: AuthSession) {
    if (!target) return;
    try {
      const headers: Record<string, string> = {};
      if (s.auth_type === "cookie") headers["Cookie"] = s.session_data.cookie;
      if (s.auth_type === "bearer") headers["Authorization"] = `Bearer ${s.session_data.token}`;
      if (s.auth_type === "basic") headers["Authorization"] = `Basic ${btoa(`${s.session_data.username}:${s.session_data.password}`)}`;
      if (s.auth_type === "custom") headers[s.session_data.header] = s.session_data.value;
      const r = await fetch(target.domain_url, { headers, mode: "no-cors" });
      toast.success(`Response status: ${r.status || "sent"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Request failed");
    }
  }

  async function remove(id: string) {
    await supabase.from("auth_sessions").delete().eq("id", id);
    load();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Authentication Sessions</SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-5">
          {!target ? (
            <p className="text-sm text-muted-foreground">Select an active target first to manage sessions.</p>
          ) : (
            <>
              <div className="glass p-4 space-y-3">
                <h3 className="text-sm font-semibold">Add Session for <span className="font-mono text-[color:var(--primary)]">{target.domain_url}</span></h3>
                <div className="space-y-1.5"><Label>Session Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Admin Account" /></div>
                <div className="space-y-1.5"><Label>Auth Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cookie">Cookie</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="custom">Custom Header</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {type === "cookie" && <Textarea value={data.cookie} onChange={(e) => setData({ ...data, cookie: e.target.value })} placeholder="session=abc123; csrf_token=xyz" className="font-mono text-xs" />}
                {type === "bearer" && <Input value={data.token} onChange={(e) => setData({ ...data, token: e.target.value })} placeholder="eyJhbGc..." className="font-mono text-xs" />}
                {type === "basic" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={data.username} onChange={(e) => setData({ ...data, username: e.target.value })} placeholder="Username" />
                    <Input type="password" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} placeholder="Password" />
                  </div>
                )}
                {type === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={data.header} onChange={(e) => setData({ ...data, header: e.target.value })} placeholder="Header name" />
                    <Input value={data.value} onChange={(e) => setData({ ...data, value: e.target.value })} placeholder="Value" />
                  </div>
                )}
                <Button onClick={save} className="w-full bg-[color:var(--primary)]">Save Session</Button>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Saved Sessions</h3>
                {list.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
                {list.map((s) => (
                  <div key={s.id} className="rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{s.session_name}</span>
                      <span className="text-[10px] uppercase rounded bg-white/5 px-1.5 py-0.5">{s.auth_type}</span>
                      {s.is_active && <span className="text-[10px] uppercase rounded bg-[color:var(--success)]/20 text-[color:var(--success)] px-1.5 py-0.5 flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Active</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Last used: {s.last_used ? new Date(s.last_used).toLocaleString() : "Never"}
                    </div>
                    <div className="flex gap-1.5">
                      {!s.is_active && <Button size="sm" variant="secondary" onClick={() => setActive(s)}>Set Active</Button>}
                      <Button size="sm" variant="ghost" onClick={() => testSession(s)}>Test</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(s.id)} className="ml-auto text-[color:var(--danger)]"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}