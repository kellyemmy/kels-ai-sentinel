
CREATE TABLE public.targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'idle' CHECK (status IN ('idle','scanning','completed','error')),
  testing_profile text,
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.targets TO anon, authenticated;
GRANT ALL ON public.targets TO service_role;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all targets" ON public.targets FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.intercepted_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE,
  method text,
  url text,
  headers jsonb,
  body text,
  response_status integer,
  response_headers jsonb,
  response_body text,
  "timestamp" timestamptz DEFAULT now(),
  flagged boolean DEFAULT false,
  flag_note text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intercepted_requests TO anon, authenticated;
GRANT ALL ON public.intercepted_requests TO service_role;
ALTER TABLE public.intercepted_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all ireq" ON public.intercepted_requests FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.vulnerabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text CHECK (severity IN ('Low','Medium','High','Critical')),
  owasp_category text,
  proof_of_concept text,
  remediation text,
  status text DEFAULT 'open' CHECK (status IN ('open','verified','false_positive')),
  discovered_at timestamptz DEFAULT now(),
  cvss_score numeric(4,1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vulnerabilities TO anon, authenticated;
GRANT ALL ON public.vulnerabilities TO service_role;
ALTER TABLE public.vulnerabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all vulns" ON public.vulnerabilities FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE,
  agent_name text CHECK (agent_name IN ('Recon','Planner','Fuzzer','Reporter')),
  log_message text,
  step_status text CHECK (step_status IN ('running','complete','error')),
  "timestamp" timestamptz DEFAULT now(),
  metadata jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_logs TO anon, authenticated;
GRANT ALL ON public.agent_logs TO service_role;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all logs" ON public.agent_logs FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.targets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intercepted_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vulnerabilities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_logs;
ALTER TABLE public.targets REPLICA IDENTITY FULL;
ALTER TABLE public.intercepted_requests REPLICA IDENTITY FULL;
ALTER TABLE public.vulnerabilities REPLICA IDENTITY FULL;
ALTER TABLE public.agent_logs REPLICA IDENTITY FULL;
