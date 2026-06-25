export type EngineStatus = "connecting" | "online" | "offline";

const STATE = { current: "connecting" as EngineStatus };
const EVENT = "kelsai:engine-status";

export function getEngineStatus(): EngineStatus {
  return STATE.current;
}

export function setEngineStatus(s: EngineStatus) {
  STATE.current = s;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: s }));
  }
}

export function onEngineStatus(cb: (s: EngineStatus) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent).detail as EngineStatus);
  window.addEventListener(EVENT, handler);
  cb(STATE.current);
  return () => window.removeEventListener(EVENT, handler);
}

export async function pingEngine(backendUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(`${backendUrl.replace(/\/$/, "")}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    const ok = r.ok;
    setEngineStatus(ok ? "online" : "offline");
    return ok;
  } catch {
    setEngineStatus("offline");
    return false;
  }
}