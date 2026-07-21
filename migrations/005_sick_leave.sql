-- Nemocenská — spusť v Supabase SQL Editoru (DEV i PROD)
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_sick boolean NOT NULL DEFAULT false;
