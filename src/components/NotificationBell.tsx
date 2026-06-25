import { useEffect, useRef, useState } from "react";
import { Bell, AlertTriangle, CheckCircle2, XCircle, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Notif = {
  id: string;
  type: "critical_vuln" | "high_vuln" | "scan_complete" | "scan_error" | "scan_launched";
  title: string;
  message: string | null;
  target_id: string | null;
  vuln_id: string | null;
  read: boolean;
  created_at: string;
};

const ICON: Record<Notif["type"], { Icon: typeof Bell; color: string }> = {
  critical_vuln:  { Icon: AlertTriangle, color: "text-[color:var(--sev-critical)]" },
  high_vuln:      { Icon: AlertTriangle, color: "text-[color:var(--sev-high)]" },
  scan_complete:  { Icon: CheckCircle2,  color: "text-[color:var(--success)]" },
  scan_error:     { Icon: XCircle,       color: "text-[color:var(--danger)]" },
  scan_launched:  { Icon: Rocket,        color: "text-[color:var(--primary)]" },
};

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    setItems((data ?? []) as Notif[]);
  }

  useEffect(() => {
    if (!user) { setItems([]); return; }
    load();
    const ch = (supabase as any)
      .channel(`notif-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p: any) => {
          setItems((cur) => [p.new as Notif, ...cur].slice(0, 80));
          const n = p.new as Notif;
          if (n.type === "critical_vuln") toast.error(`🚨 ${n.title}: ${n.message ?? ""}`);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unread = items.filter((i) => !i.read).length;

  async function markAll() {
    if (!user) return;
    await (supabase as any).from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems((cur) => cur.map((i) => ({ ...i, read: true })));
  }

  async function openOne(n: Notif) {
    if (!n.read) {
      await (supabase as any).from("notifications").update({ read: true }).eq("id", n.id);
      setItems((cur) => cur.map((i) => i.id === n.id ? { ...i, read: true } : i));
    }
    setOpen(false);
    if (n.type === "critical_vuln" || n.type === "high_vuln") {
      navigate({ to: "/vulnerabilities", search: n.vuln_id ? { open: n.vuln_id } : {} });
    } else {
      navigate({ to: "/targets" });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] p-1.5 text-white hover:bg-white/[0.06]"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[color:var(--danger)] px-1 text-[10px] font-bold text-white shadow-[0_0_6px_var(--danger)]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] rounded-lg border border-[color:var(--glass-border)] bg-[#0f1117]/95 shadow-xl backdrop-blur-xl fab-pop">
          <div className="flex items-center justify-between border-b border-[color:var(--glass-border)] px-3 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              onClick={markAll}
              className="text-[11px] text-[color:var(--primary)] hover:underline disabled:opacity-40"
              disabled={unread === 0}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-10 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-50" />
                <span className="text-xs">No notifications yet</span>
              </div>
            ) : items.map((n) => {
              const { Icon, color } = ICON[n.type];
              return (
                <button
                  key={n.id}
                  onClick={() => openOne(n)}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b border-[color:var(--glass-border)]/60 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]",
                    !n.read && "bg-white/[0.025]"
                  )}
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">{n.title}</div>
                    {n.message && <div className="truncate text-[11px] text-muted-foreground">{n.message}</div>}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-[color:var(--glass-border)] px-3 py-2 text-center">
            <button
              onClick={() => { setOpen(false); navigate({ to: "/vulnerabilities" }); }}
              className="text-[11px] text-[color:var(--primary)] hover:underline"
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const d = (Date.now() - +new Date(iso)) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
}