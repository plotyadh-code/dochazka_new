# Úkoly — ADH-PLOTY Docházkový systém

## Hotovo ✅
- Setup (Node, Git, GitHub, Supabase, Vercel)
- PRD vytvořeno + GitHub issues
- Scaffold — Next.js 16 + Supabase + Tailwind
- Databáze: tabulky `profiles` + `attendance_records`
- Login funkční (admin: obchod@adh-ploty.cz)
- Admin panel přístupný
- `createEmployee` — po vytvoření auth uživatele se vloží profil do `profiles` (rollback při chybě)
- Editace záznamu adminem ✅
- GitHub přesunut pod firemní účet: github.com/plotyadh-code/dochazka_new ✅
- Supabase přesunut pod firemní účet (projekt jxostbtyqvjgpjujkevy) ✅
- Deploy na Vercel pod plotyadh-code's projects ✅

## Nutné před testováním 🔴

### 1. Otestovat přihlášení zaměstnance
- Přidat testovacího zaměstnance přes admin panel
- Přihlásit se jako zaměstnanec
- Zkusit zapsat docházku

### 2. Otestovat admin měsíční přehled
- Zobrazit docházku zaměstnance za měsíc
- Ověřit výpočet hodin a přesčasů
- Otestovat export do Excelu

## Hotovo (nové) ✅
- Převod přesčasových hodin do dalšího měsíce (per zaměstnanec per měsíc)
- Přesčasy na víkendy a státní svátky = všechny hodiny jsou přesčas
- Státní svátky ČR pro všechny roky vč. pohyblivých Velikonoc
- Tlačítko "Vyplnit pracovní dny" v adminu — vyplní prázdné Po–Pá (mimo svátky) hodnotami 07:00–16:00, přestávka 60 min
- Zaměstnanecká app: defaultní čas Od = 06:30, Do = 16:00, přestávka 30 min
- Sloupec `auto_filled` v `attendance_records` — zaměstnanec může přepsat automaticky vyplněný den, ale ne svůj již odeslaný záznam (migrace: 003_auto_filled.sql)
- Oprava výpočtu přesčasů při převodu do dalšího měsíce — víkendy a svátky se nyní počítají správně (všechny hodiny jako přesčas)

## Hotovo (2026-07-08) ✅
- Oprava: poznámka k měsíci (`saveMonthNote`) se ukládala neatomicky (select → insert/update) — při souběžném přístupu více lidí z různých PC pod stejným admin účtem mohl druhý zápis tiše selhat na unique constraintu bez chybové hlášky. Přepsáno na atomický `upsert`, chyba se teď zobrazí u pole Poznámka.
- Oprava: stejná race condition byla i v `setOvertimeMode` při zápisu převedených hodin do řádku dalšího měsíce — opraveno stejným způsobem (atomický upsert), tlačítko Proplatit/Převést se navíc při selhání vrátí do původního stavu a zobrazí chybu.
- Oprava: Excel export počítal přesčas u víkendů/svátků ze surového sloupce `overtime` (odpracováno − 8h) místo správné logiky jako na webu (celé hodiny navíc). Opraveno.
- Oprava: Excel export zapisoval hodiny jako text (`.toFixed(2)`) — Excel je bral jako text, nešlo s nimi počítat. Teď se zapisují jako skutečná čísla s formátem, zobrazí se s čárkou dle českého nastavení Excelu a jde s nimi počítat (SUMA apod.).
- Excel export: přidán/přepočítán souhrn přesčasu — řádek "Převedeno z [měsíc]" je vždy před řádkem CELKEM (i s hodnotou 0), CELKEM v přesčasu ukazuje, co ještě zbývá dorovnat po započtení převodu (0, pokud převod schodek pokryl), řádek "Zůstatek na konci měsíce" ukazuje kladný kredit přenášený do dalšího měsíce.
- Oprava: souhrn v Excelu se počítal stejně bez ohledu na zvolený režim. Teď u "Proplatit" CELKEM ukazuje skutečný přesčas za měsíc a Zůstatek je 0 (nic se nepřevádí), u "Převést" CELKEM ukazuje zbývající schodek po převodu a Zůstatek kredit přenášený dál.
- Oprava: admin stránky (docházka detail, docházka list, zaměstnanci) označeny `force-dynamic` + globálně vypnutý Next.js client router cache (`staleTimes.dynamic = 0`) — jiný admin už neuvidí starší zobrazení (např. starý režim Proplatit/Převést) kvůli cachování stránky.

## Další kroky 🟡

### 3. Archivace dokumentů (Excel)
- Zachovat posledních 6 měsíců exportů na zaměstnance
- Starší záznamy archivovat (nemazat z DB, jen označit)

### 4. Svátky v měsíčním přehledu
- Řádek svátku barevně odlišit (stejně jako víkend)
- Hodiny počítat stejně jako pracovní den
- Seznam státních svátků ČR natvrdo nebo konfigurovatelně

## Poznámky
- Trigger `on_auth_user_created` byl smazán (způsoboval chyby) — profily vytváří app
- Admin účet: obchod@adh-ploty.cz (heslo v Supabase Auth)
- GitHub: github.com/plotyadh-code/dochazka_new
- Vercel: plotyadh-code's projects
- Supabase: projekt jxostbtyqvjgpjujkevy (firemní účet)
- Tabulka profiles má sloupce: id, name, role, email, initial_password, created_at
- Víkendy a svátky: hodiny se počítají stejně, jen řádek má jinou barvu
- Přesčasy: data připravuje appka, výpočet nuancí řeší účetní externě
