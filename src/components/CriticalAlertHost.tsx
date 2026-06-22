import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { X, AlertTriangle } from "lucide-react";

type Vuln = {
  id: string;
  title: string;
  severity: string;
  owasp_category: string | null;
};

export function CriticalAlertHost() {
  const [alerts, setAlerts] = useState<Vuln[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel("vuln-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vulnerabilities" },
        (payload) => {
          const v = payload.new as Vuln;
          if (v.severity === "High" || v.severity === "Critical") {
            setAlerts((prev) => [...prev, v]);
            setTimeout(() => {
              setAlerts((prev) => prev.filter((a) => a.id !== v.id));
            }, 8000);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[340px] flex-col-reverse gap-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="pointer-events-auto relative overflow-hidden rounded-lg border border-[color:var(--gold)] bg-white/[0.05] backdrop-blur-md p-4 glow-gold slide-in-up"
          style={{ borderLeftWidth: 3 }}
        >
          <button
            type="button"
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            onClick={() => setAlerts((p) => p.filter((x) => x.id !== a.id))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5 text-glow-gold text-[color:var(--gold)] font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" />
            {a.severity === "Critical" ? "Critical Finding" : "High Severity Finding"}
          </div>
          <div className="mt-1 text-sm font-medium text-white truncate">{a.title}</div>
          <div className="text-[11px] text-muted-foreground">{a.owasp_category}</div>
          <Link
            to="/vulnerabilities"
            search={{ open: a.id } as any}
            className="mt-2 inline-block text-xs text-[color:var(--gold)] hover:underline"
          >
            View Details →
          </Link>
          <div
            className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-[color:var(--gold)]"
            style={{ animation: "drain 8s linear forwards" }}
          />
        </div>
      ))}
    </div>
  );
}