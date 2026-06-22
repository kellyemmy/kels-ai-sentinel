import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Crosshair, Radio, ShieldAlert, Zap } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/targets", label: "Target Manager", icon: Crosshair },
  { to: "/proxy", label: "Live Intercept Proxy", icon: Radio },
  { to: "/vulnerabilities", label: "Vulnerability Tracker", icon: ShieldAlert },
  { to: "/studio", label: "API Testing Studio", icon: Zap },
] as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a page…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {ITEMS.map((it) => (
            <CommandItem
              key={it.to}
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: it.to });
              }}
            >
              <it.icon className="mr-2 h-4 w-4" />
              {it.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}