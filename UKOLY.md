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

## Nalezené, zatím neřešené 🟠
- Nemocenská se počítá jako přesčas v plné výši odpracovaných hodin (`is_sick` → `hours_worked` místo `overtime`). Zapsaných 8 h na nemocenské přičte +8 h přesčasu místo 0. Ověřit s účetní, jestli je to záměr.
- Zaměstnanec může měnit docházku přímo z klienta (`AttendanceForm.tsx:85`) bez serverové kontroly oprávnění.

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
- GitHub: github.com/plotyadh-code/dochazka_new — pushovat vždy pod firemním účtem `plotyadh-code`, ne pod osobním účtem (commit author je nastavený v `git config --local`)
- Vercel: plotyadh-code's projects
- Supabase: projekt jxostbtyqvjgpjujkevy (firemní účet)
- Tabulka profiles má sloupce: id, name, role, email, initial_password, created_at
- Tabulka `employee_work_modes` (employee_id, year, month, mode) = „od tohoto měsíce platí režim". Prázdné = režim Zaměstnanec.
- Víkendy a svátky: hodiny se počítají stejně, jen řádek má jinou barvu
- Přesčasy: data připravuje appka, výpočet nuancí řeší účetní externě
- Tabulka `monthly_overtime` (employee_id, year, month, mode, note): `mode` = „od tohoto měsíce platí Proplatit/Převést", prázdné = Proplatit. Sloupec `carried_in` se **už nepoužívá** (zůstal jen historicky, drží se v něm 0) — zůstatek se počítá v `src/lib/carryover.ts`
