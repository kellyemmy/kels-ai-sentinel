
-- program_configs
CREATE TABLE public.program_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE,
  program_name text,
  platform text,
  program_url text,
  in_scope_assets text,
  out_of_scope_assets text,
  special_rules text,
  reward_critical_min integer,
  reward_critical_max integer,
  reward_high_min integer,
  reward_high_max integer,
  reward_medium_min integer,
  reward_medium_max integer,
  reward_low_min integer,
  reward_low_max integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_configs TO authenticated;
GRANT ALL ON public.program_configs TO service_role;
ALTER TABLE public.program_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc auth select" ON public.program_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "pc auth insert" ON public.program_configs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pc auth update" ON public.program_configs FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pc auth delete" ON public.program_configs FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- subdomains
CREATE TABLE public.subdomains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE,
  subdomain_url text,
  status_code integer,
  ip_address text,
  technologies text,
  open_ports text,
  in_scope boolean DEFAULT true,
  discovered_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subdomains TO authenticated;
GRANT ALL ON public.subdomains TO service_role;
ALTER TABLE public.subdomains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sd auth select" ON public.subdomains FOR SELECT TO authenticated USING (true);
CREATE POLICY "sd auth insert" ON public.subdomains FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "sd auth update" ON public.subdomains FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "sd auth delete" ON public.subdomains FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- js_intelligence
CREATE TABLE public.js_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE,
  js_file_url text,
  extracted_endpoints text,
  secrets_found boolean DEFAULT false,
  secrets_detail text,
  file_size_kb integer,
  discovered_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.js_intelligence TO authenticated;
GRANT ALL ON public.js_intelligence TO service_role;
ALTER TABLE public.js_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ji auth select" ON public.js_intelligence FOR SELECT TO authenticated USING (true);
CREATE POLICY "ji auth insert" ON public.js_intelligence FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ji auth update" ON public.js_intelligence FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ji auth delete" ON public.js_intelligence FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- tech_fingerprints
CREATE TABLE public.tech_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE,
  technology_name text,
  version text,
  category text,
  known_vulnerable boolean DEFAULT false,
  cve_reference text,
  discovered_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_fingerprints TO authenticated;
GRANT ALL ON public.tech_fingerprints TO service_role;
ALTER TABLE public.tech_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tf auth select" ON public.tech_fingerprints FOR SELECT TO authenticated USING (true);
CREATE POLICY "tf auth insert" ON public.tech_fingerprints FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tf auth update" ON public.tech_fingerprints FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tf auth delete" ON public.tech_fingerprints FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- notes
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE,
  title text,
  content text,
  severity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no auth select" ON public.notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "no auth insert" ON public.notes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "no auth update" ON public.notes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "no auth delete" ON public.notes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- custom_payloads
CREATE TABLE public.custom_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text,
  payload text,
  context_tag text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_payloads TO authenticated;
GRANT ALL ON public.custom_payloads TO service_role;
ALTER TABLE public.custom_payloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp auth select" ON public.custom_payloads FOR SELECT TO authenticated USING (true);
CREATE POLICY "cp auth insert" ON public.custom_payloads FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cp auth update" ON public.custom_payloads FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cp auth delete" ON public.custom_payloads FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_program_configs_updated_at BEFORE UPDATE ON public.program_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.subdomains;
ALTER PUBLICATION supabase_realtime ADD TABLE public.js_intelligence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tech_fingerprints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
