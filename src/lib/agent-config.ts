const KEY = "kelsai.agentConfig.v1";

export type AgentConfig = {
  backendUrl: string;
  apiKey: string;
  maxConcurrent: number;
  requestDelayMs: number;
  scanTimeoutMin: number;
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  backendUrl: "http://localhost:8000/api/v1/agent",
  apiKey: "",
  maxConcurrent: 10,
  requestDelayMs: 500,
  scanTimeoutMin: 60,
};

export function loadAgentConfig(): AgentConfig {
  if (typeof window === "undefined") return DEFAULT_AGENT_CONFIG;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_AGENT_CONFIG;
    return { ...DEFAULT_AGENT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AGENT_CONFIG;
  }
}

export function saveAgentConfig(cfg: AgentConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(cfg));
}

// Generic per-form persistence
export function loadForm<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
export function saveForm<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
}