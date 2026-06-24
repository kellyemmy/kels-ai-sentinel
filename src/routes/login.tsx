import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KelsLogo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Kels.Ai" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="glass w-full max-w-md p-8 space-y-5">
        <div className="flex flex-col items-center gap-3 mb-2">
          <KelsLogo size={48} />
          <h1 className="text-xl font-bold text-glow-blue">Welcome back</h1>
          <p className="text-xs text-muted-foreground">Sign in to Kels.Ai</p>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <p className="text-xs text-[color:var(--danger)]">{err}</p>}
        <Button type="submit" disabled={loading} className="w-full bg-[color:var(--primary)] hover:bg-[color:var(--primary)]/90 h-11">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
        <div className="flex items-center justify-between text-xs">
          <Link to="/forgot-password" className="text-[color:var(--primary)] hover:underline">Forgot password?</Link>
          <Link to="/signup" className="text-muted-foreground hover:text-foreground">Don't have an account? <span className="text-[color:var(--primary)]">Sign Up</span></Link>
        </div>
      </form>
    </div>
  );
}