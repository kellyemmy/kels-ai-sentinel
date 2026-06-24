
CREATE TABLE public.auth_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_id UUID REFERENCES public.targets(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('cookie','bearer','basic','custom')),
  session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_sessions TO authenticated;
GRANT ALL ON public.auth_sessions TO service_role;

ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read auth_sessions"
  ON public.auth_sessions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated insert auth_sessions"
  ON public.auth_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update auth_sessions"
  ON public.auth_sessions FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated delete auth_sessions"
  ON public.auth_sessions FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX auth_sessions_target_idx ON public.auth_sessions(target_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.auth_sessions;
