import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password"];

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      navigate({ to: "/login", search: { redirect: pathname } as any, replace: true });
    }
    if (user && isPublic) {
      navigate({ to: "/", replace: true });
    }
  }, [user, loading, isPublic, pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!user && !isPublic) return null;
  return <>{children}</>;
}

export function isPublicPath(p: string) {
  return PUBLIC_ROUTES.includes(p);
}