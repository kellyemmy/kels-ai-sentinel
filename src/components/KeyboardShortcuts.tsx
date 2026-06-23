import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "⌘/Ctrl + K", description: "Open command palette" },
  { keys: "Shift + P", description: "Open Payload Library" },
  { keys: "?", description: "Show keyboard shortcuts" },
  { keys: "Esc", description: "Close dialogs and drawers" },
  { keys: "G then D", description: "Go to Dashboard (via palette)" },
  { keys: "G then T", description: "Go to Targets (via palette)" },
];

export function KeyboardShortcutsHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setOpen(v => !v);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Keyboard Shortcuts</DialogTitle></DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys} className="border-b border-[color:var(--glass-border)] last:border-0">
                <td className="py-2 pr-4"><kbd className="rounded bg-white/5 border border-[color:var(--glass-border)] px-2 py-0.5 font-mono text-xs">{s.keys}</kbd></td>
                <td className="py-2 text-muted-foreground">{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}