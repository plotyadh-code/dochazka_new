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

## Hotovo (2026-07-21) ✅
- Nový režim **Nemocenská** (checkbox vedle Dovolené, vzájemně se vylučují): výchozí stav 0 hodin (Od = Do), ale na rozdíl od Dovolené zůstávají pole Od/Do i Místo práce editovatelná — jde tedy zapsat i skutečně odpracovaný čas, pokud zaměstnanec během neschopenky pracoval (např. z domova). Odpracované hodiny se pak počítají celé jako přesčas, stejně jako u víkendu/svátku (nový sloupec `is_sick` v `attendance_records`, migrace `005_sick_leave.sql`). Zvýrazněno fialově v tabulce, na mobilu i v Excel exportu (typ dne "Nemocenská").
- Oprava: v admin měsíčním přehledu (`MonthlyAttendanceTable`) se poznámka k měsíci a zvolený režim přesčasu (Proplatit/Převést) držely ve stavu komponenty, který se při přepnutí měsíce šipkami nevynuloval — po přechodu na jiný měsíc chvíli zůstával viditelný text/režim z předchozího měsíce a při uložení by se mohl omylem zapsat pod špatný měsíc. Opraveno přidáním `key` podle roku/měsíce, který vynutí čistý remount komponenty při každé změně měsíce.

## Hotovo (2026-08-04) ✅
- Nové **pracovní režimy zaměstnance** — přepínač **Zaměstnanec / Hodinář** (migrace `006_work_mode.sql`, tabulka `employee_work_modes`).
  - **Zaměstnanec** = beze změny oproti dosavadnímu chování (8 h/den, přesčasy, víkendy a svátky, dovolená, nemocenská, převod přesčasů). Výchozí režim — kdo nemá nic nastaveno, je Zaměstnanec, takže veškerá stávající data zůstávají stejná.
  - **Hodinář** = brigádníci a lidé, kteří fakturují hodiny. Počítají se jen čisté odpracované hodiny: žádná povinná denní doba, žádný přesčas, žádná pravidla kalendáře (víkend/svátek nemají zvláštní význam), žádný převod hodin, skryté tlačítko „Vyplnit pracovní dny", skrytá Dovolená i Nemocenská, nezapsaný den se nezvýrazňuje žlutě.
  - **Historie zůstává** — režim se ukládá jako „platí od tohoto měsíce dál". Změna nikdy nepřepíše starší měsíce; pro každý měsíc se použije poslední nastavení, které začíná v něm nebo dřív.
  - Přepínač je na dvou místech: v seznamu **Zaměstnanci** (platí od aktuálního měsíce dál) a v **měsíčním detailu docházky** (platí od zobrazeného měsíce dál — jde tím opravit i měsíc zpětně, když se na přepnutí zapomnělo). Funguje i u už založených zaměstnanců.
  - Excel export pro Hodináře: všechny dny v měsíci, sloupce Datum / Den / Od / Do / Přestávka / Odpracováno / Místo práce / Čas zápisu, bez sloupců Přesčas a Typ dne, bez řádků převodu a zůstatku. Na konci CELKEM se součtem hodin a řádek „Odpracovaných dní".
  - Migrace `006_work_mode.sql` spuštěna v Supabase ✅, otestováno lokálně ✅, nasazeno (commit `5e248f8`) ✅

## Hotovo (2026-09-03) ✅
- **Oprava převodu přesčasů mezi měsíci.** Zůstatek se ukládal jednorázově při kliknutí na „Převést" (`monthly_overtime.carried_in`) — když se pak starší měsíc opravil, další měsíc si držel staré číslo. U Nikoly Šimkové ukazovalo září „Převedeno ze srpna +16.00" místo správných +14.25 (srpen: 16.75 z července − 2.50).
  - Nový `src/lib/carryover.ts` — jediné místo, kde se počítá přesčas za den, součet za měsíc a řetěz převodů. Zůstatek se **nikde neukládá**, dopočítává se při čtení z celé historie docházky, takže se sám opraví i zpětně.
  - `setOvertimeMode` ukládá už jen režim, nezapisuje nic do dalšího měsíce. `saveMonthNote` opraven, aby uložením poznámky nepřepsal zděděný režim na „Proplatit".
  - **Režim „Proplatit / Převést" se dědí dopředu** (poslední nastavení platí dál, stejně jako pracovní režim) — na konci měsíce se už nemusí nic potvrzovat.
  - Migrace `007_carryover_recalc.sql` spuštěna v Supabase ✅ — smazala prázdné řádky `monthly_overtime`, které vznikaly jako vedlejší efekt klikání a blokovaly by dědění režimu. Nasazeno (commit `a3a05f0`) ✅

## Zamčení docházky a oprávnění (2026-09-03) 🔐
Pravidlo: **co zaměstnanec jednou odešle, platí — opravy dělá admin.** Do teď to hlídal jen kód
v prohlížeči; anon klíč je veřejně v JS bundlu a RLS byla `allow_all`, takže to šlo obejít.
- Zápis docházky jde přes server action `src/app/dochazka/actions.ts` — `employee_id` se bere z přihlášené session, ne z parametru. Formulář už do DB nesahá přímo.
- `src/lib/auth.ts` → `requireAdmin()` / `requireUser()`. Všechny admin akce (docházka i zaměstnanci) si teď ověřují roli samy — ochrana ve `layout.tsx` a `proxy.ts` hlídá jen navigaci, server action jde zavolat i bez otevření stránky.
- Migrace `008_rls_policies.sql` — RLS politiky místo `allow_all` na všech čtyřech tabulkách. Zaměstnanec vidí a mění jen svoje; den s `auto_filled = false` (odeslaný) nepřepíše ani přes API. Funkce `is_admin()` (SECURITY DEFINER kvůli rekurzi na `profiles`). Na konci souboru je připravený rollback.
- ⚠️ Migraci spustit nejdřív na DEV, otestovat, teprve pak PROD.

## Hotovo (2026-10-14) ✅
- **Pravidla svátků podle mzdové účetní** (`src/lib/carryover.ts`, commit `12072db`):
  - Svátek v pracovní den: Odpracováno (fond) = skutečné hodiny, max 8 h; přesčas jen hodiny nad 8 h. Méně než 8 h přesčas nesnižuje (ani plus, ani mínus).
  - Svátek o víkendu: fond = skutečné hodiny, max 8 h; přesčas = všechny odpracované hodiny (hodiny do 8 h jsou tedy ve fondu i v přesčasu — záměr).
  - Svátek bez zápisu = fond 0. Nemoc ve svátek = fond 0, přesčas jako u nemocenské (všechny hodiny).
  - Excel: „Státní svátek" tučně — u Zaměstnance ve sloupci Typ dne (i když svátek padne na víkend), u Hodináře v novém posledním sloupci Svátek.
- **6. 1. odstraněn ze státních svátků** — v ČR to svátek není (commit `762f725`). Seznam ověřen proti přehledu svátků 2027.
- Výpočet se dělá vždy z celé historie, takže nová pravidla platí i zpětně pro minulé měsíce — uživatelka potvrdila, že je to v pořádku.
- Nemocenská (dřív „nalezené, neřešené"): potvrzeno 2026-10-13, že fond 0 a odpracované hodiny celé do přesčasu je správně.
- ⚠️ Netestováno v prohlížeči — projít jeden Excel export za měsíc se svátkem (Zaměstnanec i Hodinář).

## Bývalí zaměstnanci a řazení (2026-10-14) — commit `5d02c67`
- Seznamy v Zaměstnancích i Docházce řazené podle **příjmení** (poslední slovo jména, česká abeceda — CH za H). `src/lib/employees.ts`.
- Zaškrtávátko **„Už nepracuje / vyřazen"** jen na kartě v Zaměstnancích → zaměstnanec se přesune do tabulky **Bývalí zaměstnanci** (pod aktivními, zašedle, i v Docházce). Docházka a exporty zůstávají k náhledu.
- Bývalý se **nepřihlásí**: ban v Supabase Auth (`auth.admin.updateUserById`, `ban_duration`) + `proxy.ts` odhlásí ještě platnou session. Odškrtnutím se vše vrátí (obousměrně).
- Sloupec `profiles.is_active` — migrace `010_employee_active.sql` — 🔴 **spustit v Supabase**. Bez ní appka funguje dál (všichni aktivní), jen zaškrtnutí skončí chybou.
- ⚠️ Netestováno v prohlížeči: zaškrtnout testovacího zaměstnance → přesun + pokus o přihlášení → odškrtnout → přihlášení funguje.

## Další kroky 🟡

### 3. Archivace dokumentů (Excel)
- Zachovat posledních 6 měsíců exportů na zaměstnance
- Starší záznamy archivovat (nemazat z DB, jen označit)

### 4. Svátky v měsíčním přehledu
- ~~Řádek svátku barevně odlišit~~ (hotovo — šedě na webu, tučně „Státní svátek" v Excelu)
- ~~Pravidla výpočtu~~ (hotovo 2026-10-14, viz výše)

## Poznámky
- Trigger `on_auth_user_created` byl smazán (způsoboval chyby) — profily vytváří app
- Admin účet: obchod@adh-ploty.cz (heslo v Supabase Auth)
- GitHub: github.com/plotyadh-code/dochazka_new — pushovat vždy pod firemním účtem `plotyadh-code`, ne pod osobním účtem (commit author je nastavený v `git config --local`)
- Vercel: plotyadh-code's projects
- Supabase: projekt jxostbtyqvjgpjujkevy (firemní účet)
- Tabulka profiles má sloupce: id, name, role, email, initial_password, created_at
- Tabulka `employee_work_modes` (employee_id, year, month, mode) = „od tohoto měsíce platí režim". Prázdné = režim Zaměstnanec.
- Víkendy a svátky: hodiny se počítají stejně, jen řádek má jinou barvu
- Přesčasy: data připravuje appka, výpočet nuancí řeší účetní externě
- Tabulka `monthly_overtime` (employee_id, year, month, mode, note): `mode` = „od tohoto měsíce platí Proplatit/Převést", prázdné = Proplatit. Sloupec `carried_in` se **už nepoužívá** (zůstal jen historicky, drží se v něm 0) — zůstatek se počítá v `src/lib/carryover.ts`
- Tabulka `hourly_actions` (employee_id, year, month, description, amount) = AKCE Hodinářů — práce placená zakázkou. Bez data, patří do měsíce odeslání. Hodinář jen přidává, opravy/mazání jen admin. Migrace `009_hourly_actions.sql` — **spustit v Supabase** (2026-10-09).
