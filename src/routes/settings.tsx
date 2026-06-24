import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, AlertTriangle, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { loadAgentConfig, saveAgentConfig } from "@/lib/agent-config";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Kels.Ai" }] }),
  component: SettingsPage,
});

const AVATAR_COLORS = ["#1976d2", "#10b981", "#8b5cf6", "#ef4444", "#f59e0b", "#14b8a6"];

function SettingsPage() {
  const { user } = useAuth();
  const meta = (user?.user_metadata ?? {}) as any;
  const [fullName, setFullName] = useState(meta.full_name ?? "");
  const [avatarColor, setAvatarColor] = useState(meta.avatar_color ?? AVATAR_COLORS[0]);
  const [config, setConfig] = useState(loadAgentConfig());
  const [showKey, setShowKey] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState(meta.anthropic_api_key ?? "");
  const [anthropicModel, setAnthropicModel] = useState(meta.anthropic_model ?? "claude-sonnet-4-6");
  const [shodanKey, setShodanKey] = useState(meta.shodan_api_key ?? "");
  const [virusTotalKey, setVirusTotalKey] = useState(meta.virustotal_api_key ?? "");
  const [notifs, setNotifs] = useState({
    critical: meta.notif_critical ?? true,
    high: meta.notif_high ?? false,
    sound: meta.notif_sound ?? false,
    autoOpen: meta.notif_auto_open ?? false,
    showStream: meta.show_stream ?? true,
  });
  const [appearance, setAppearance] = useState({
    theme: meta.theme ?? "dark",
    accent: meta.accent ?? "#1976d2",
    sidebar: meta.sidebar ?? "full",
    fontSize: meta.font_size ?? "medium",
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", appearance.accent);
    const map = { small: "14px", medium: "16px", large: "18px" } as any;
    document.documentElement.style.fontSize = map[appearance.fontSize] ?? "16px";
  }, [appearance.accent, appearance.fontSize]);

  async function saveMeta(patch: Record<string, any>) {
    const { error } = await supabase.auth.updateUser({ data: { ...meta, ...patch } });
    if (error) toast.error(error.message);
    else toast.success("Saved");
  }

  async function exportData() {
    const [targets, vulns, notes, logs] = await Promise.all([
      supabase.from("targets").select("*"),
      supabase.from("vulnerabilities").select("*"),
      supabase.from("notes").select("*"),
      supabase.from("agent_logs").select("*"),
    ]);
    const blob = new Blob([JSON.stringify({ targets: targets.data, vulnerabilities: vulns.data, notes: notes.data, agent_logs: logs.data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kelsai-export-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold text-glow-blue">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account, API keys and preferences</p>
      </header>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="data">Data & Export</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="glass p-5 space-y-4 mt-4">
          <div className="space-y-1.5"><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={user?.email ?? ""} disabled className="font-mono" /></div>
          <div className="space-y-2">
            <Label>Avatar Color</Label>
            <div className="flex gap-2">
              {AVATAR_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setAvatarColor(c)} className={`h-9 w-9 rounded-full border-2 ${avatarColor === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <Button onClick={() => saveMeta({ full_name: fullName, avatar_color: avatarColor })} className="bg-[color:var(--primary)]">Save Profile</Button>
        </TabsContent>

        <TabsContent value="api" className="space-y-4 mt-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> API keys are stored in your account. Never share your account credentials.
          </div>
          <div className="glass p-5 space-y-3">
            <h3 className="font-semibold">AI Engine</h3>
            <div className="space-y-1.5"><Label>Agent Backend URL</Label><Input value={config.backendUrl} onChange={(e) => setConfig({ ...config, backendUrl: e.target.value })} className="font-mono" /></div>
            <Button size="sm" variant="secondary" onClick={() => { saveAgentConfig(config); toast.success("Saved"); }}>Save Backend URL</Button>
          </div>
          <div className="glass p-5 space-y-3">
            <h3 className="font-semibold">Anthropic API</h3>
            <div className="space-y-1.5"><Label>API Key</Label>
              <div className="relative">
                <Input type={showKey ? "text" : "password"} value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} className="font-mono pr-9" />
                <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Model</Label>
              <Select value={anthropicModel} onValueChange={setAnthropicModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet-4-6">claude-sonnet-4-6</SelectItem>
                  <SelectItem value="claude-opus-4-6">claude-opus-4-6</SelectItem>
                  <SelectItem value="claude-haiku-4-5">claude-haiku-4-5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => saveMeta({ anthropic_api_key: anthropicKey, anthropic_model: anthropicModel })} className="bg-[color:var(--primary)]">Save Keys</Button>
          </div>
          <div className="glass p-5 space-y-3">
            <h3 className="font-semibold">External Tools (Optional)</h3>
            <div className="space-y-1.5"><Label>Shodan API Key</Label><Input type="password" value={shodanKey} onChange={(e) => setShodanKey(e.target.value)} className="font-mono" /></div>
            <div className="space-y-1.5"><Label>VirusTotal API Key</Label><Input type="password" value={virusTotalKey} onChange={(e) => setVirusTotalKey(e.target.value)} className="font-mono" /></div>
            <Button size="sm" onClick={() => saveMeta({ shodan_api_key: shodanKey, virustotal_api_key: virusTotalKey })} className="bg-[color:var(--primary)]">Save</Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="glass p-5 space-y-3 mt-4">
          <ToggleRow label="Desktop notifications for Critical findings" checked={notifs.critical} onChange={(v) => setNotifs({ ...notifs, critical: v })} />
          <ToggleRow label="Desktop notifications for High findings" checked={notifs.high} onChange={(v) => setNotifs({ ...notifs, high: v })} />
          <ToggleRow label="Sound alert on new vulnerability" checked={notifs.sound} onChange={(v) => setNotifs({ ...notifs, sound: v })} />
          <ToggleRow label="Auto-open finding drawer on Critical discovery" checked={notifs.autoOpen} onChange={(v) => setNotifs({ ...notifs, autoOpen: v })} />
          <ToggleRow label="Show Agent Thought Stream on Dashboard" checked={notifs.showStream} onChange={(v) => setNotifs({ ...notifs, showStream: v })} />
          <Button onClick={() => saveMeta({ notif_critical: notifs.critical, notif_high: notifs.high, notif_sound: notifs.sound, notif_auto_open: notifs.autoOpen, show_stream: notifs.showStream })} className="bg-[color:var(--primary)]">Save Preferences</Button>
        </TabsContent>

        <TabsContent value="appearance" className="glass p-5 space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2">
              {["dark", "light", "system"].map((t) => (
                <Button key={t} size="sm" variant={appearance.theme === t ? "default" : "secondary"} onClick={() => setAppearance({ ...appearance, theme: t })}>{t}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Accent Color</Label>
            <div className="flex gap-2">
              {[{n:"Royal Blue",c:"#1976d2"},{n:"Cyan",c:"#06b6d4"},{n:"Purple",c:"#8b5cf6"},{n:"Green",c:"#10b981"}].map((p) => (
                <button key={p.c} onClick={() => setAppearance({ ...appearance, accent: p.c })} className={`h-9 w-9 rounded-full border-2 ${appearance.accent === p.c ? "border-white" : "border-transparent"}`} style={{ background: p.c }} title={p.n} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sidebar Style</Label>
            <Select value={appearance.sidebar} onValueChange={(v) => setAppearance({ ...appearance, sidebar: v })}>
              <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="full">Full (labels)</SelectItem><SelectItem value="compact">Compact (icons)</SelectItem><SelectItem value="auto">Auto-collapse</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Font Size</Label>
            <Select value={appearance.fontSize} onValueChange={(v) => setAppearance({ ...appearance, fontSize: v })}>
              <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="small">Small</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent>
            </Select>
          </div>
          <Button onClick={() => saveMeta({ theme: appearance.theme, accent: appearance.accent, sidebar: appearance.sidebar, font_size: appearance.fontSize })} className="bg-[color:var(--primary)]">Save Appearance</Button>
        </TabsContent>

        <TabsContent value="data" className="space-y-4 mt-4">
          <div className="glass p-5 space-y-3">
            <h3 className="font-semibold">Export & Cleanup</h3>
            <Button onClick={exportData} variant="secondary"><Download className="mr-2 h-4 w-4" />Export All Data</Button>
            <Button onClick={async () => {
              if (!confirm("Delete all agent logs? This cannot be undone.")) return;
              await supabase.from("agent_logs").delete().not("id", "is", null);
              toast.success("Cleared scan history");
            }} variant="secondary"><Trash2 className="mr-2 h-4 w-4" />Clear Scan History</Button>
          </div>
          <div className="rounded-md border border-[color:var(--danger)]/60 bg-[color:var(--danger)]/5 p-5 space-y-3">
            <h3 className="font-semibold text-[color:var(--danger)]">Danger Zone</h3>
            <Button variant="destructive" onClick={async () => {
              const v = prompt('Type "DELETE" to confirm deletion of ALL targets:');
              if (v !== "DELETE") return;
              await supabase.from("targets").delete().not("id", "is", null);
              toast.success("All targets deleted");
            }}>Delete All Targets</Button>
            <Button variant="destructive" onClick={async () => {
              const v = prompt('Type "DELETE" to confirm account deletion:');
              if (v !== "DELETE") return;
              await supabase.auth.signOut();
              toast("Signed out. Contact support to fully delete your account.");
            }}>Delete Account</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] px-3 py-2">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}