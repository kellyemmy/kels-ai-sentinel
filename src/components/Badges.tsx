import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/owasp";

export function SeverityBadge({ severity }: { severity: Severity | string | null | undefined }) {
  const s = (severity ?? "Low") as Severity;
  const styles: Record<Severity, string> = {
    Low:      "bg-[color:var(--sev-low)]/15 text-[color:var(--sev-low)] border-[color:var(--sev-low)]/30",
    Medium:   "bg-[color:var(--sev-medium)]/15 text-[color:var(--sev-medium)] border-[color:var(--sev-medium)]/30",
    High:     "bg-[color:var(--sev-high)]/15 text-[color:var(--sev-high)] border-[color:var(--sev-high)]/30",
    Critical: "bg-[color:var(--sev-critical)]/15 text-[color:var(--sev-critical)] border-[color:var(--sev-critical)]/40 glow-red",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", styles[s] ?? styles.Low)}>
      {s}
    </span>
  );
}

const METHOD_STYLES: Record<string, string> = {
  GET:     "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  POST:    "bg-[color:var(--primary)]/15 text-[color:var(--primary)] border-[color:var(--primary)]/30",
  PUT:     "bg-[color:var(--gold)]/15 text-[color:var(--gold)] border-[color:var(--gold)]/30",
  PATCH:   "bg-[color:var(--agent-planner)]/15 text-[color:var(--agent-planner)] border-[color:var(--agent-planner)]/30",
  DELETE:  "bg-[color:var(--danger)]/15 text-[color:var(--danger)] border-[color:var(--danger)]/30",
  OPTIONS: "bg-muted text-muted-foreground border-border",
  HEAD:    "bg-muted text-muted-foreground border-border",
  MANUAL:  "bg-[color:var(--agent-reporter)]/15 text-[color:var(--agent-reporter)] border-[color:var(--agent-reporter)]/30",
};

export function MethodBadge({ method }: { method: string | null | undefined }) {
  const m = (method ?? "GET").toUpperCase();
  return (
    <span className={cn("inline-flex min-w-[58px] justify-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider", METHOD_STYLES[m] ?? METHOD_STYLES.GET)}>
      {m}
    </span>
  );
}

export function StatusCodeBadge({ code }: { code: number | null | undefined }) {
  if (!code) return <span className="text-xs text-muted-foreground font-mono">—</span>;
  const cls =
    code < 300 ? "text-[color:var(--success)] border-[color:var(--success)]/30 bg-[color:var(--success)]/10" :
    code < 400 ? "text-[color:var(--primary)] border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10" :
    code < 500 ? "text-[color:var(--gold)] border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10" :
                 "text-[color:var(--danger)] border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10";
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold", cls)}>
      {code}
    </span>
  );
}

export function TargetStatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "idle";
  if (s === "scanning") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/15 px-2 py-0.5 text-xs text-[color:var(--primary)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)] pulse-dot" /> scanning
      </span>
    );
  }
  const map: Record<string, string> = {
    idle: "bg-muted text-muted-foreground border-border",
    completed: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    error: "bg-[color:var(--danger)]/15 text-[color:var(--danger)] border-[color:var(--danger)]/30",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", map[s] ?? map.idle)}>
      {s}
    </span>
  );
}

export function AgentBadge({ name }: { name: string | null | undefined }) {
  const map: Record<string, string> = {
    Recon:    "bg-[color:var(--agent-recon)]/15 text-[color:var(--agent-recon)] border-[color:var(--agent-recon)]/30",
    Planner:  "bg-[color:var(--agent-planner)]/15 text-[color:var(--agent-planner)] border-[color:var(--agent-planner)]/30",
    Fuzzer:   "bg-[color:var(--agent-fuzzer)]/15 text-[color:var(--agent-fuzzer)] border-[color:var(--agent-fuzzer)]/30",
    Reporter: "bg-[color:var(--agent-reporter)]/15 text-[color:var(--agent-reporter)] border-[color:var(--agent-reporter)]/30",
  };
  const n = name ?? "Recon";
  return (
    <span className={cn("inline-flex min-w-[68px] justify-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase", map[n] ?? map.Recon)}>
      {n}
    </span>
  );
}