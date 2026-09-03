-- Zamčení dat na úrovni databáze (RLS)
-- Spusť v Supabase SQL Editoru — NEJDŘÍV DEV, otestovat, teprve pak PROD
--
-- Do teď měly všechny tabulky politiku "allow_all" — kdokoliv přihlášený mohl
-- přes veřejný anon klíč (je v JS bundlu prohlížeče) číst i měnit cokoliv,
-- včetně cizích záznamů. Aplikace to hlídala jen ve svém kódu.
--
-- Nová pravidla:
--   * zaměstnanec vidí a zapisuje jen svoje
--   * jednou odeslaný den (auto_filled = false) už zaměstnanec nepřepíše —
--     opravu dělá admin
--   * admin vidí a mění všechno
--
-- createEmployee / deleteEmployee běží pod service role klíčem, ten RLS obchází.

-- Pomocná funkce: je přihlášený uživatel admin?
-- SECURITY DEFINER — čte profiles mimo RLS, jinak by politika na profiles
-- volala sama sebe donekonečna.
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


-- ── profiles ────────────────────────────────────────────────────────────────
-- Zaměstnanec vidí jen svůj profil (potřeba při přihlášení kvůli roli).
-- Zakládání a mazání profilů dělá service role.

DROP POLICY IF EXISTS "profiles_allow_all" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ── attendance_records ──────────────────────────────────────────────────────
-- Zaměstnanec zapisuje jen sám za sebe a jen dokud den není odeslaný.
--   auto_filled = true  → den předvyplněný adminem, zaměstnanec ho smí přepsat
--   auto_filled = false → odesláno zaměstnancem, zamčeno (opravu řeší admin)

DROP POLICY IF EXISTS "attendance_records_allow_all" ON attendance_records;

CREATE POLICY "attendance_select" ON attendance_records
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_admin());

CREATE POLICY "attendance_insert" ON attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (employee_id = auth.uid() AND auto_filled = false)
  );

CREATE POLICY "attendance_update" ON attendance_records
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (employee_id = auth.uid() AND auto_filled = true)
  )
  WITH CHECK (
    public.is_admin()
    OR (employee_id = auth.uid() AND auto_filled = false)
  );

CREATE POLICY "attendance_delete" ON attendance_records
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ── monthly_overtime ────────────────────────────────────────────────────────
-- Režim přesčasů a poznámky k měsíci nastavuje jen admin.

DROP POLICY IF EXISTS "monthly_overtime_allow_all" ON monthly_overtime;

CREATE POLICY "monthly_overtime_select" ON monthly_overtime
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_admin());

CREATE POLICY "monthly_overtime_write" ON monthly_overtime
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── employee_work_modes ─────────────────────────────────────────────────────
-- Zaměstnanec svůj režim vidí (appka podle něj skrývá dovolenou/nemocenskou),
-- měnit ho může jen admin.

DROP POLICY IF EXISTS "employee_work_modes_allow_all" ON employee_work_modes;

CREATE POLICY "employee_work_modes_select" ON employee_work_modes
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_admin());

CREATE POLICY "employee_work_modes_write" ON employee_work_modes
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── Rollback ────────────────────────────────────────────────────────────────
-- Kdyby se něco rozbilo, tímhle se vrátí původní volný stav:
--
-- DROP POLICY IF EXISTS "profiles_select" ON profiles;
-- DROP POLICY IF EXISTS "profiles_insert" ON profiles;
-- DROP POLICY IF EXISTS "profiles_update" ON profiles;
-- DROP POLICY IF EXISTS "profiles_delete" ON profiles;
-- CREATE POLICY "profiles_allow_all" ON profiles FOR ALL USING (true) WITH CHECK (true);
--
-- DROP POLICY IF EXISTS "attendance_select" ON attendance_records;
-- DROP POLICY IF EXISTS "attendance_insert" ON attendance_records;
-- DROP POLICY IF EXISTS "attendance_update" ON attendance_records;
-- DROP POLICY IF EXISTS "attendance_delete" ON attendance_records;
-- CREATE POLICY "attendance_records_allow_all" ON attendance_records FOR ALL USING (true) WITH CHECK (true);
--
-- DROP POLICY IF EXISTS "monthly_overtime_select" ON monthly_overtime;
-- DROP POLICY IF EXISTS "monthly_overtime_write" ON monthly_overtime;
-- CREATE POLICY "monthly_overtime_allow_all" ON monthly_overtime FOR ALL USING (true) WITH CHECK (true);
--
-- DROP POLICY IF EXISTS "employee_work_modes_select" ON employee_work_modes;
-- DROP POLICY IF EXISTS "employee_work_modes_write" ON employee_work_modes;
-- CREATE POLICY "employee_work_modes_allow_all" ON employee_work_modes FOR ALL USING (true) WITH CHECK (true);
