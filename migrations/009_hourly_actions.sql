-- AKCE u Hodinářů — práce placená zakázkou, ne hodinově (např. "Akce Novák Humpolec 3 000 Kč")
-- Spusť v Supabase SQL Editoru (DEV i PROD)
--
-- Akce nemá datum — patří do měsíce, ve kterém byla odeslána (year, month).
-- Hodinář může přidávat kolik akcí chce, ale odeslanou akci už nezmění ani nesmaže;
-- opravy dělá admin. Slouží jako podklad pro fakturu.

-- is_admin() je i v migraci 008 — tady znovu, aby šla 009 spustit samostatně
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS hourly_actions (
  id bigserial PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  description text NOT NULL CHECK (length(trim(description)) > 0),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hourly_actions_employee_month_idx
  ON hourly_actions (employee_id, year, month);

ALTER TABLE hourly_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hourly_actions_select" ON hourly_actions;
DROP POLICY IF EXISTS "hourly_actions_insert" ON hourly_actions;
DROP POLICY IF EXISTS "hourly_actions_update" ON hourly_actions;
DROP POLICY IF EXISTS "hourly_actions_delete" ON hourly_actions;

CREATE POLICY "hourly_actions_select" ON hourly_actions
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_admin());

CREATE POLICY "hourly_actions_insert" ON hourly_actions
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid() OR public.is_admin());

-- Úpravy a mazání jen admin
CREATE POLICY "hourly_actions_update" ON hourly_actions
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "hourly_actions_delete" ON hourly_actions
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS hourly_actions;
