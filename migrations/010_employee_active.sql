-- Aktivní / bývalý zaměstnanec
-- Spusť v Supabase SQL Editoru (DEV i PROD)
--
-- Zaškrtnutí „Už nepracuje / vyřazen" v adminu (Zaměstnanci) nastaví is_active = false:
-- zaměstnanec se přesune do tabulky bývalých, jeho docházka zůstává k náhledu,
-- ale nepřihlásí se. Odškrtnutím se vrátí mezi aktivní a přihlášení zase funguje.
-- Stávající zaměstnanci zůstávají aktivní.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
