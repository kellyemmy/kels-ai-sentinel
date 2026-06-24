import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KelsLogo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, MailCheck } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset Password — Kels.Ai" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="glass w-full max-w-md p-8 space-y-5">
        <div className="flex flex-col items-center gap-3 mb-2">
          <KelsLogo size={48} />
          <h1 className="text-xl font-bold text-glow-blue">Reset your password</h1>
        </div>
        {sent ? (
          <div className="rounded-md border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 p-4 text-sm text-[color:var(--success)] flex items-center gap-2">
            <MailCheck className="h-4 w-4" /> Check your email for a reset link.
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            {err && <p className="text-xs text-[color:var(--danger)]">{err}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90 h-11">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </>
        )}
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/login" className="text-[color:var(--primary)] hover:underline">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}