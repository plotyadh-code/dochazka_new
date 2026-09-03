-- Převod přesčasů: zůstatek se už neukládá, dopočítává se z docházky
-- Spusť v Supabase SQL Editoru (DEV i PROD)
--
-- Do teď se při kliknutí na "Převést" zapsal do dalšího měsíce pevný zůstatek
-- (monthly_overtime.carried_in). Když se pak starší měsíc opravil, číslo v dalším
-- měsíci zůstalo staré. Nově se zůstatek počítá při čtení (src/lib/carryover.ts),
-- takže sloupec carried_in už nic neřídí — zůstává jen jako historická hodnota.
--
-- Zároveň se režim "Proplatit / Převést" dědí do dalších měsíců (poslední
-- nastavení platí dál). Kliknutí na "Převést" ale dřív automaticky založilo
-- řádek pro následující měsíc s mode = 'pay'. Takový řádek by dědění přebil,
-- proto se prázdné automaticky vzniklé řádky mažou.
--
-- Maže se jen to, co nenese žádnou informaci:
--   mode = 'pay' (výchozí hodnota) + žádná poznámka + v daném měsíci není docházka.

DELETE FROM monthly_overtime mo
WHERE mo.mode = 'pay'
  AND (mo.note IS NULL OR btrim(mo.note) = '')
  AND NOT EXISTS (
    SELECT 1 FROM attendance_records ar
    WHERE ar.employee_id = mo.employee_id
      AND date_trunc('month', ar.date) = make_date(mo.year, mo.month, 1)
  );

-- Vynulování nepoužívaného sloupce, ať v datech nestraší stará čísla.
UPDATE monthly_overtime SET carried_in = 0 WHERE carried_in <> 0;
