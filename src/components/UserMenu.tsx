import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as any;
  const fullName = meta.full_name ?? user.email ?? "User";
  const color = meta.avatar_color ?? "#1976d2";
  const initials = String(fullName).split(/\s+/).map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }} title={fullName}>
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm font-semibold">{fullName}</div>
          <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
          <SettingsIcon className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login", replace: true }); }}>
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}