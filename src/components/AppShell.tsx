import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Crosshair,
  Radio,
  ShieldAlert,
  Zap,
  Search,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { KelsLogo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { CriticalAlertHost } from "@/components/CriticalAlertHost";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/targets", label: "Target Manager", icon: Crosshair },
  { to: "/proxy", label: "Live Intercept Proxy", icon: Radio },
  { to: "/vulnerabilities", label: "Vulnerability Tracker", icon: ShieldAlert },
  { to: "/studio", label: "API Testing Studio", icon: Zap },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "sticky top-0 z-30 flex h-screen flex-col border-r border-[color:var(--glass-border)] bg-sidebar/80 backdrop-blur-md transition-[width] duration-200",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        <div className="flex items-center gap-3 px-4 pt-5 pb-4">
          <KelsLogo size={collapsed ? 30 : 34} />
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-glow-blue text-base font-bold tracking-tight text-white">Kels.Ai</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Autonomous Penetration Intelligence
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "mx-3 mb-3 flex items-center gap-2 rounded-md border border-[color:var(--glass-border)] bg-white/[0.03] px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06]",
            collapsed && "justify-center"
          )}
          title="Command palette"
        >
          <Search className="h-3.5 w-3.5" />
          {!collapsed && <>
            <span>Search…</span>
            <kbd className="ml-auto rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </>}
        </button>

        <nav className="flex-1 space-y-1 px-2">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[color:var(--primary)]/12 text-white"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[color:var(--primary)] shadow-[0_0_8px_var(--primary)]" />
                )}
                <Icon className={cn("h-4 w-4 shrink-0", active && "text-[color:var(--primary)]")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mx-3 my-3 rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-white/[0.06]"
        >
          {collapsed ? "›" : "‹ Collapse"}
        </button>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <CriticalAlertHost />
    </div>
  );
}