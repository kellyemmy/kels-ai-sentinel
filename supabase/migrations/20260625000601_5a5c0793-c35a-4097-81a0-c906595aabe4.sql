
-- ============ notifications table ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('critical_vuln','high_vuln','scan_complete','scan_error','scan_launched')),
  title text NOT NULL,
  message text,
  target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE,
  vuln_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============ trigger: vulnerability inserted (Critical/High) ============
CREATE OR REPLACE FUNCTION public.notify_on_vulnerability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ntype text;
  ntitle text;
BEGIN
  IF NEW.severity = 'Critical' THEN
    ntype := 'critical_vuln';
    ntitle := 'Critical vulnerability discovered';
  ELSIF NEW.severity = 'High' THEN
    ntype := 'high_vuln';
    ntitle := 'High severity vulnerability';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, target_id, vuln_id)
  SELECT u.id, ntype, ntitle, NEW.title, NEW.target_id, NEW.id
  FROM auth.users u;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_vuln ON public.vulnerabilities;
CREATE TRIGGER trg_notify_vuln
  AFTER INSERT ON public.vulnerabilities
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_vulnerability();

-- ============ trigger: target status change ============
CREATE OR REPLACE FUNCTION public.notify_on_target_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ntype text;
  ntitle text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' THEN
    ntype := 'scan_complete';
    ntitle := 'Scan completed';
  ELSIF NEW.status = 'error' THEN
    ntype := 'scan_error';
    ntitle := 'Scan ended with error';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, target_id)
  SELECT u.id, ntype, ntitle, NEW.domain_url, NEW.id
  FROM auth.users u;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_target_status ON public.targets;
CREATE TRIGGER trg_notify_target_status
  AFTER UPDATE OF status ON public.targets
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_target_status();

-- ============ vulnerabilities.status workflow ============
-- Normalise any unknown statuses to 'open' first
UPDATE public.vulnerabilities
  SET status = 'open'
  WHERE status IS NULL
     OR status NOT IN ('open','in_progress','verified','submitted','false_positive');

ALTER TABLE public.vulnerabilities
  DROP CONSTRAINT IF EXISTS vulnerabilities_status_check;
ALTER TABLE public.vulnerabilities
  ADD CONSTRAINT vulnerabilities_status_check
  CHECK (status IN ('open','in_progress','verified','submitted','false_positive'));
ALTER TABLE public.vulnerabilities
  ALTER COLUMN status SET DEFAULT 'open';
