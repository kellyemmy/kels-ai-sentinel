import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KelsLogo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign Up — Kels.Ai" }] }),
  component: SignupPage,
});

function strength(pw: string): { label: string; pct: number; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: "Weak", pct: 33, color: "var(--danger)" };
  if (score <= 3) return { label: "Fair", pct: 66, color: "#f59e0b" };
  return { label: "Strong", pct: 100, color: "var(--success)" };
}

function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const s = useMemo(() => strength(password), [password]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) { setErr("Passwords don't match"); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, onboarding_complete: false },
      },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    navigate({ to: "/onboarding", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="glass w-full max-w-md p-8 space-y-5">
        <div className="flex flex-col items-center gap-3 mb-2">
          <KelsLogo size={48} />
          <h1 className="text-xl font-bold text-glow-blue">Create your account</h1>
        </div>
        <div className="space-y-1.5">
          <Label>Full Name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {password && (
            <div className="space-y-1">
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${s.pct}%`, background: s.color }} />
              </div>
              <p className="text-[10px]" style={{ color: s.color }}>{s.label}</p>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Confirm Password</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {err && <p className="text-xs text-[color:var(--danger)]">{err}</p>}
        <Button type="submit" disabled={loading} className="w-full bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90 h-11">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Already have an account? <Link to="/login" className="text-[color:var(--primary)] hover:underline">Sign In</Link>
        </p>
      </form>
    </div>
  );
}