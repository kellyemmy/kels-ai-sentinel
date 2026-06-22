export const OWASP_CATEGORIES = [
  "A01:2021 Broken Access Control",
  "A02:2021 Cryptographic Failures",
  "A03:2021 Injection",
  "A04:2021 Insecure Design",
  "A05:2021 Security Misconfiguration",
  "A06:2021 Vulnerable & Outdated Components",
  "A07:2021 Identification & Auth Failures",
  "A08:2021 Software & Data Integrity Failures",
  "A09:2021 Security Logging & Monitoring Failures",
  "A10:2021 Server-Side Request Forgery",
] as const;

export type Severity = "Low" | "Medium" | "High" | "Critical";
export const SEVERITIES: Severity[] = ["Low", "Medium", "High", "Critical"];

export const SEVERITY_COLOR: Record<Severity, string> = {
  Low: "var(--sev-low)",
  Medium: "var(--sev-medium)",
  High: "var(--sev-high)",
  Critical: "var(--sev-critical)",
};

export const AGENT_PHASES = [
  "Recon",
  "Mapping",
  "Fuzzing",
  "Exploitation",
  "Reporting",
] as const;