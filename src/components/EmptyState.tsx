import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-full border border-[color:var(--glass-border)] bg-white/[0.02]">
        <Icon className="h-7 w-7 text-[color:var(--primary)]" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}