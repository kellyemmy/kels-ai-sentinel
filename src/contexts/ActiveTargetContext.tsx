import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ActiveTarget = { id: string; domain_url: string } | null;

type Ctx = {
  target: ActiveTarget;
  setTarget: (t: ActiveTarget) => void;
};

const ActiveTargetCtx = createContext<Ctx>({ target: null, setTarget: () => {} });
const KEY = "kelsai.activeTarget";

export function ActiveTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<ActiveTarget>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setTargetState(JSON.parse(raw));
    } catch {}
  }, []);

  function setTarget(t: ActiveTarget) {
    setTargetState(t);
    if (typeof window !== "undefined") {
      if (t) window.localStorage.setItem(KEY, JSON.stringify(t));
      else window.localStorage.removeItem(KEY);
    }
  }

  return (
    <ActiveTargetCtx.Provider value={{ target, setTarget }}>{children}</ActiveTargetCtx.Provider>
  );
}

export function useActiveTarget() {
  return useContext(ActiveTargetCtx);
}