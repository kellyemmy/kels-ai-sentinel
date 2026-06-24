import { useEffect, useState } from "react";
import { loadAgentConfig } from "@/lib/agent-config";
import { toast } from "sonner";

type Status = "connecting" | "online" | "offline";

export function BackendStatus({ onChange }: { onChange?: (s: Status) => void }) {
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    let mounted = true;
    let lastStatus: Status = "connecting";
    async function ping() {
      const cfg = loadAgentConfig();
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3500);
        const r = await fetch(`${cfg.backendUrl.replace(/\/$/, "")}/health`, { signal: ctrl.signal });
        clearTimeout(t);
        const next: Status = r.ok ? "online" : "offline";
        if (mounted) {
          if (lastStatus === "offline" && next === "online") toast.success("Engine reconnected ✓");
          setStatus(next);
          onChange?.(next);
          lastStatus = next;
        }
      } catch {
        if (mounted) {
          setStatus("offline");
          onChange?.("offline");
          lastStatus = "offline";
        }
      }
    }
    ping();
    const i = setInterval(ping, 30_000);
    return () => { mounted = false; clearInterval(i); };
  }, [onChange]);

  const colors = { online: "var(--success)", offline: "var(--danger)", connecting: "#f59e0b" } as const;
  const labels = { online: "Engine Online", offline: "Engine Offline", connecting: "Connecting..." } as const;

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground" title={labels[status]}>
      <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: colors[status] }} />
      <span className="hidden sm:inline">{labels[status]}</span>
    </div>
  );
}