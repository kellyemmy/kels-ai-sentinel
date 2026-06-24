import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Crosshair, Radio, ShieldAlert, Zap, Search,
  Shield, Radar, FileText, ClipboardList, Sun, Moon, Keyboard, Target as TargetIcon,
  Settings as SettingsIcon, Menu, X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { KelsLogo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { CriticalAlertHost } from "@/components/CriticalAlertHost";
import { ActiveTargetProvider, useActiveTarget } from "@/contexts/ActiveTargetContext";
import { CvssCalculatorHost } from "@/components/CvssCalculator";
import { PayloadLibraryHost } from "@/components/PayloadLibrary";
import { KeyboardShortcutsHost } from "@/components/KeyboardShortcuts";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGate, isPublicPath } from "@/components/AuthGate";
import { UserMenu } from "@/components/UserMenu";
import { BackendStatus } from "@/components/BackendStatus";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV_PRIMARY: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/targets", label: "Target Manager", icon: Crosshair },
  { to: "/proxy", label: "Live Intercept Proxy", icon: Radio },
  { to: "/vulnerabilities", label: "Vulnerability Tracker", icon: ShieldAlert },
  { to: "/studio", label: "API Testing Studio", icon: Zap },
];
const NAV_SECONDARY: NavItem[] = [
  { to: "/scope", label: "Scope Manager", icon: Shield },
  { to: "/recon", label: "Recon Lab", icon: Radar },
  { to: "/notes", label: "Notes Workspace", icon: FileText },
  { to: "/report", label: "Report Builder", icon: ClipboardList },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ActiveTargetProvider>
        <AuthGate>
          <ShellRouter>{children}</ShellRouter>
        </AuthGate>
      </ActiveTargetProvider>
    </AuthProvider>
  );
}

function ShellRouter({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isPublicPath(pathname) || pathname === "/onboarding") {
    return <>{children}</>;
  }
  return <Shell pathname={pathname}>{children}</Shell>;
}

function Shell({ children, pathname }: { children: ReactNode; pathname: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "z-40 flex h-screen flex-col border-r border-[color:var(--glass-border)] bg-sidebar/95 backdrop-blur-md transition-all duration-200",
          "md:sticky md:top-0",
          mobileOpen
            ? "fixed inset-y-0 left-0 w-[260px]"
            : "fixed inset-y-0 left-0 -translate-x-full md:translate-x-0 md:relative",
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

        <nav className="flex-1 space-y-1 px-2 overflow-y-auto">
          {NAV_PRIMARY.map((item) => <NavLink key={item.to} item={item} pathname={pathname} collapsed={collapsed} />)}
          <div className="my-3 mx-1 border-t border-[color:var(--glass-border)]" />
          {NAV_SECONDARY.map((item) => <NavLink key={item.to} item={item} pathname={pathname} collapsed={collapsed} />)}
          <div className="my-3 mx-1 border-t border-[color:var(--glass-border)]" />
          <NavLink item={{ to: "/settings", label: "Settings", icon: SettingsIcon }} pathname={pathname} collapsed={collapsed} />
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mx-3 my-3 rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-white/[0.06]"
        >
          {collapsed ? "›" : "‹ Collapse"}
        </button>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />}

      <main className="min-w-0 flex-1">
        <TopBar onMenu={() => setMobileOpen((v) => !v)} mobileOpen={mobileOpen} />
        {children}
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <CriticalAlertHost />
      <CvssCalculatorHost />
      <PayloadLibraryHost />
      <KeyboardShortcutsHost />
    </div>
  );
}

function NavLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
  const Icon = item.icon;
  return (
    <Link
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
}

function TopBar({ onMenu, mobileOpen }: { onMenu: () => void; mobileOpen: boolean }) {
  const { target } = useActiveTarget();
  const [engineOffline, setEngineOffline] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("kelsai.theme") as any) ?? "dark";
  });

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "light") html.classList.add("light");
    else html.classList.remove("light");
    localStorage.setItem("kelsai.theme", theme);
  }, [theme]);

  return (
    <>
    <div className="sticky top-0 z-20 flex h-12 items-center justify-end gap-2 border-b border-[color:var(--glass-border)] bg-background/60 px-4 backdrop-blur-md">
      <button
        type="button"
        onClick={onMenu}
        className="md:hidden mr-auto rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] p-1.5 text-muted-foreground"
        title="Menu"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
      {target ? (
        <div className="md:mr-auto hidden md:inline-flex items-center gap-1.5 rounded-full border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 px-2.5 py-0.5 text-[11px] text-[color:var(--primary)]">
          <TargetIcon className="h-3 w-3" />
          <span className="font-mono">{target.domain_url}</span>
        </div>
      ) : (
        <div className="md:mr-auto hidden md:block text-[11px] text-muted-foreground">No active target — pick one on any page</div>
      )}
      <BackendStatus onChange={(s) => setEngineOffline(s === "offline")} />
      <button
        type="button"
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
        className="rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] p-1.5 text-muted-foreground hover:bg-white/[0.06]"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="rounded-md border border-[color:var(--glass-border)] bg-white/[0.02] p-1.5 text-muted-foreground hover:bg-white/[0.06]"
        title="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <UserMenu />
    </div>
    {engineOffline && !bannerDismissed && (
      <div className="sticky top-12 z-10 flex items-center gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
        <span>⚠ Kels.Ai agent backend is unreachable. Scans will not run until the engine is online. Start with:</span>
        <code className="font-mono bg-black/40 px-2 py-0.5 rounded">cd core_engine &amp;&amp; python main.py</code>
        <button onClick={() => setBannerDismissed(true)} className="ml-auto text-amber-300 hover:text-white">Dismiss</button>
      </div>
    )}
    </>
  );
}