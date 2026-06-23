
-- Drop existing permissive policies
DROP POLICY IF EXISTS "public all targets" ON public.targets;
DROP POLICY IF EXISTS "public all ireq" ON public.intercepted_requests;
DROP POLICY IF EXISTS "public all vulns" ON public.vulnerabilities;
DROP POLICY IF EXISTS "public all logs" ON public.agent_logs;

-- Revoke anon access
REVOKE ALL ON public.targets FROM anon;
REVOKE ALL ON public.intercepted_requests FROM anon;
REVOKE ALL ON public.vulnerabilities FROM anon;
REVOKE ALL ON public.agent_logs FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intercepted_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vulnerabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_logs TO authenticated;

GRANT ALL ON public.targets TO service_role;
GRANT ALL ON public.intercepted_requests TO service_role;
GRANT ALL ON public.vulnerabilities TO service_role;
GRANT ALL ON public.agent_logs TO service_role;

-- Authenticated-only policies, split by command (no USING(true) on write ops)
CREATE POLICY "targets auth select" ON public.targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "targets auth insert" ON public.targets FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "targets auth update" ON public.targets FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "targets auth delete" ON public.targets FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "ireq auth select" ON public.intercepted_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "ireq auth insert" ON public.intercepted_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ireq auth update" ON public.intercepted_requests FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ireq auth delete" ON public.intercepted_requests FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "vulns auth select" ON public.vulnerabilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "vulns auth insert" ON public.vulnerabilities FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "vulns auth update" ON public.vulnerabilities FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "vulns auth delete" ON public.vulnerabilities FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "logs auth select" ON public.agent_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs auth insert" ON public.agent_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "logs auth update" ON public.agent_logs FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "logs auth delete" ON public.agent_logs FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Restrict Realtime channel subscriptions to authenticated users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);
