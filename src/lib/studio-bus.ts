// Tiny event bus to send a request from the Proxy page into the Studio page.
export type StudioPreload = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
};

const KEY = "kelsai.studio.preload";

export function setStudioPreload(p: StudioPreload) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(p));
}
export function takeStudioPreload(): StudioPreload | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(KEY);
  try { return JSON.parse(raw); } catch { return null; }
}

// Payload library → Studio body injection
const PAYLOAD_KEY = "kelsai.studio.payload";
export function setStudioPayload(payload: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PAYLOAD_KEY, payload);
  window.dispatchEvent(new CustomEvent("kelsai:studio-payload", { detail: payload }));
}
export function takeStudioPayload(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PAYLOAD_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(PAYLOAD_KEY);
  return raw;
}