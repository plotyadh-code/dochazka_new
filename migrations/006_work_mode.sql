-- Pracovní režim zaměstnance: 'employee' (Zaměstnanec) / 'hourly' (Hodinář)
-- Spusť v Supabase SQL Editoru (DEV i PROD)
--
-- Historie se drží principem "platí od tohoto měsíce dál":
-- pro zobrazovaný měsíc se použije poslední záznam s (year, month) <= zobrazovaný měsíc.
-- Když pro zaměstnance žádný záznam není, platí 'employee' — tzn. veškerá dosavadní
-- data zůstávají beze změny.

CREATE TABLE IF NOT EXISTS employee_work_modes (
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  mode text NOT NULL CHECK (mode IN ('employee', 'hourly')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, year, month)
);

ALTER TABLE employee_work_modes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_work_modes_allow_all" ON employee_work_modes;
CREATE POLICY "employee_work_modes_allow_all" ON employee_work_modes
  FOR ALL USING (true) WITH CHECK (true);
