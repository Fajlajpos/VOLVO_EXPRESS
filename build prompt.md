# Zadání pro AI: Webová aplikace na dělení nákladů na cestu autem

Chci, abys vytvořil(a) webovou aplikaci, která partě lidí cestujících autem (na výlet, trip, dovolenou) usnadní spravedlivé rozdělení nákladů na palivo a vygeneruje platební QR kód, kterým ostatní jednoduše pošlou svůj podíl řidiči. Aplikace pracuje **výhradně s měnou CZK** (česká koruna).

## 1. Základní koncept

Aplikace funguje takto:

1. Uživatel (řidič / organizátor) založí novou jízdu ("trip").
2. Zadá odkud kam se pojede – pomocí napojení na mapové API se automaticky doplní adresy a vypočítá vzdálenost trasy (bez vizuálního zobrazení mapy, jde čistě o výpočet).
3. Zadá průměrnou spotřebu auta (l/100 km), aktuální cenu paliva a počet lidí, kteří se na nákladech podílí.
4. Aplikace průběžně počítá odhadovanou cenu cesty a podíl na osobu. Admin může **kdykoliv během jízdy přidat nebo odebrat uživatele**, přičemž se výsledná částka pro všechny okamžitě automaticky přepočítá.
5. Po ukončení trasy (nebo celého tripu, pokud má více úseků/zastávek) aplikace vygeneruje platební QR kódy s vypočítanou částkou (číslo účtu se bere automaticky z lokálního Nastavení) – standardně jeden sdílený QR kód pro všechny, pokud ale admin u někoho ručně upraví částku, vygeneruje se pro něj samostatný QR kód a ostatním se přepočítá podíl tak, aby vše sedělo na celkovou cenu (podrobně viz sekce 2.2 a 2.3).
6. U QR kódu jsou dvě samostatná tlačítka: tlačítko **"Sdílet"** (otevře systémové menu sdílení telefonu, kde uživatel vybere, komu QR kód pošle) a tlačítko **"Uložit"** (uloží QR kód jako obrázek přímo do galerie/fotek zařízení) – podrobně popsáno v sekci 2.3.

## 2. Hlavní funkce (Core features)

### 2.1 Vytvoření jízdy
- Formulář: odkud, kam, s možností přidat libovolný počet dalších zastávek na trase (tlačítko "+ Přidat zastávku") – celková vzdálenost se spočítá jako součet vzdáleností mezi jednotlivými body v pořadí, v jakém byly zadány.
- Přepínač **"Jen tam" / "Tam a zpět"** – pokud je zapnutá varianta "Tam a zpět", appka k vypočítané vzdálenosti jedné cesty automaticky připočítá i zpáteční cestu (vynásobí trasu dvěma, aby se šetřily API limity), a tato celková vzdálenost se pak použije do výpočtu celkové ceny.
- Napojení na **OpenRouteService API** (zdarma, bez nutnosti platební karty), konkrétně:
  - geocoding endpoint pro automatické doplňování adres (autocomplete) a převod zadaných míst na souřadnice,
  - directions endpoint pro výpočet vzdálenosti trasy (v km) mezi zadanými body.
  - **Žádná vizuální mapa se nezobrazuje** – jde čistě o výpočet vzdálenosti na pozadí, kterou appka použije do vzorce na výpočet ceny. Nepoužívej tedy žádnou knihovnu na zobrazení mapy (např. Leaflet) ani placená API typu Google Maps.
- Zadání průměrné spotřeby vozidla (l/100 km) – výchozí hodnota se automaticky předvyplní podle hodnoty uložené v Nastavení (viz sekce 3), ale lze ji pro konkrétní jízdu ručně přepsat.
- Výběr typu paliva (benzín / nafta) a zadání aktuální ceny za litr – jako výchozí (přednastavenou) hodnotu nastav aktuální průměrnou cenu v ČR: **nafta 34 Kč/l, benzín 37 Kč/l**, s možností kdykoliv ručně upravit podle aktuální situace na čerpací stanici. Typ paliva se zároveň automaticky předvyplní podle hodnoty uložené v Nastavení.
- Appka má **dynamický seznam spolujezdců spravovaný přes UI a uložený v `localStorage`** – pro začátek tam dej např. 7 ukázkových jmen (Petr, Jana, Tomáš, Lucie, Martin, Eva, Honza), která si uživatel může kdykoliv v Nastavení nebo při jízdě upravit, smazat nebo přidat nová.
- Při zakládání jízdy (nebo kdykoliv v jejím průběhu) si admin jednoduše **zaškrtne (checkboxy), kteří ze spolujezdců s ním tentokrát jedou** – počet osob pro výpočet nákladů se odvodí automaticky podle počtu zaškrtnutých jmen.

### 2.2 Výpočet nákladů
- Automatický výpočet: vzdálenost × (spotřeba / 100) × cena paliva = celková cena cesty.
- Výchozí rozdělení celkové ceny rovným dílem mezi všechny zaškrtnuté spolujezdce (viz sekce 2.1).
- **Ruční úprava částky u jednotlivého spolujezdce:** admin může u kteréhokoliv konkrétního spolujezdce ručně přepsat jeho částku (např. mu sníží podíl z 30 Kč na 20 Kč). Appka v takovém případě automaticky přepočítá zbývající částku (celková cena mínus součet ručně upravených částek) a rozdělí ji rovným dílem mezi zbylé spolujezdce, kterým se tím pádem podíl odpovídajícím způsobem zvýší, aby součet všech částek (upravených i neupravených) pořád seděl na celkovou cenu cesty.
  - Příklad: jede 5 lidí, cena na osobu běžně vychází na 30 Kč. Admin sníží jednomu spolujezdci částku na 20 Kč → appka přepočítá zbylé 4 spolujezdce tak, aby jejich nový (mírně zvýšený) podíl spolu s těmi 20 Kč dohromady opět dal správnou celkovou cenu.
- Aplikace musí hlídat, aby admin nemohl zadat ruční částku (nebo součet ručních částek) vyšší, než je celková cena cesty, aby ostatním nevznikala záporná částka k platbě.
- **Smazání člověka s "ručně upravenou částkou":** Pokud je odškrtnut/odebrán spolujezdec, který měl ručně upravenou částku, jeho fixní úprava se resetuje a zbylá cena cesty se opět automaticky rozdělí rovným dílem mezi zbývající zaškrtnuté spolujezdce.
- Přehledné zobrazení mezivýsledku ještě před ukončením jízdy (průběžný odhad).
- **Odolnost vůči refreshi stránky:** rozpracovaná (ještě neukončená) jízda se musí průběžně automaticky ukládat do `localStorage`, aby uživatel o zadaná data nepřišel při náhodném refreshi, zavření prohlížeče nebo ztrátě signálu v autě. Při opětovném otevření appky se rozpracovaná jízda automaticky načte tam, kde uživatel skončil.

### 2.3 Ukončení jízdy / tripu a platba
- Tlačítko "Ukončit jízdu" / "Ukončit trip".
- Po ukončení se zobrazí finální souhrn (trasa, vzdálenost, celková cena, cena na osobu).
- Číslo účtu se nezadává ručně ke každé jízdě – appka ho automaticky načte z hodnoty uložené v Nastavení (viz sekce 3.2). Uživatel může volitelně doplnit jen zprávu pro příjemce (např. název výletu), případně variabilní symbol.
- Vygenerují se platební QR kódy podle českého standardu **QR Platba** (formát SPAYD, např. `SPD*1.0*ACC:CZ...*AM:123.00*CC:CZK*MSG:...`):
  - **jeden sdílený QR kód** s částkou pro všechny spolujezdce, kterým admin částku ručně neupravil (standardní rovný díl),
  - a **samostatný individuální QR kód** pro každého spolujezdce, kterému admin částku ručně upravil (viz sekce 2.2).
  - Pokud admin žádnou částku ručně neupraví, vygeneruje se jen ten jeden sdílený QR kód pro úplně všechny.
- **Absence sdíleného QR kódu (Edge case):** Pokud admin (řidič) ručně upraví částku úplně VŠEM zaškrtnutým spolujezdcům, společný (sdílený) QR kód s rovným dílem se vůbec nevygeneruje a uživateli se zobrazí pouze ty samostatné individuální kódy.
- Tlačítko "Odeslat" / "Sdílet" – využije nativní funkci sdílení prohlížeče/zařízení (Web Share API), takže po kliknutí se na mobilu (např. na iPhonu) automaticky otevře systémové menu sdílení, kde uživatel vybere, komu a přes jakou appku (SMS, WhatsApp, e-mail apod.) QR kód pošle. Na zařízeních/prohlížečích, kde Web Share API není podporované, zobraz náhradní řešení (např. tlačítko "Kopírovat odkaz/obrázek").
- Samostatné tlačítko "Uložit QR kód" – umožní QR kód stáhnout/uložit přímo do galerie/fotek zařízení jako obrázek (na mobilu typicky přes stažení souboru nebo přes Web Share API s možností "Uložit do Fotek").

## 3. Přihlášení a nastavení

### 3.1 Přihlášení
- Aplikace je určená pouze pro jednoho uživatele (organizátora/řidiče), proto stačí jednoduché přihlášení bez registrace a bez více účtů.
- Přihlašovací údaje (e-mail a heslo) definuj v `.env` souboru (např. proměnné `LOGIN_EMAIL` a `LOGIN_PASSWORD`) – pro začátek tam vyplň libovolný náhodný ukázkový e-mail a heslo, které si uživatel později sám změní.
- Bez přihlášení (špatně zadané údaje) se zobrazí pouze přihlašovací formulář, po úspěšném přihlášení se zobrazí celá aplikace.
- V aplikaci (např. v hlavičce nebo v Nastavení) musí být tlačítko **"Odhlásit se"**, které ukončí přihlášenou session a vrátí uživatele zpět na přihlašovací formulář.
- **Důležité upozornění pro AI:** jelikož jde o čistě statickou (frontend-only) aplikaci bez vlastního backend serveru, hodnoty z `.env` se při buildu zabudují přímo do veřejného JS kódu. Toto přihlášení slouží jen jako jednoduchá clona proti běžnému návštěvníkovi, ne jako plnohodnotné zabezpečení – to je pro účel aplikace (jeden soukromý uživatel) v pořádku, ale zmiň to v `README.md`.
- Přihlašovací údaje jsou stejné na všech zařízeních (jsou zabudované přímo v appce při buildu, nejsou vázané na konkrétní telefon/počítač) – uživatel se tedy na libovolném novém zařízení přihlásí stejným e-mailem a heslem z `.env`. Je ale potřeba počítat s tím, že se tím synchronizuje pouze přihlášení, nikoliv data – nastavení (účet, spotřeba, spolujezdci) a rozpracovaná jízda žijí pouze lokálně v `localStorage` daného prohlížeče/zařízení (viz sekce 3.2), takže na novém zařízení budou tyto hodnoty po přihlášení prázdné a uživatel si je musí znovu vyplnit.

### 3.2 Nastavení
- Po přihlášení má uživatel v sekci „Nastavení" možnost zadat a uložit:
  - **svoje číslo bankovního účtu** (ve formátu IBAN nebo českém formátu účtu) pro platby,
  - svoji průměrnou spotřebu vozidla (l/100 km),
  - svůj typ paliva (benzín / nafta) a výchozí ceny paliva,
  - **seznam jmen spolujezdců** (přidávání/mazání lidí).
- Tyto hodnoty se uloží lokálně do `localStorage` prohlížeče (protože appka je bez backendu) a automaticky se předvyplní při zakládání každé další jízdy, aniž by je uživatel musel zadávat pokaždé znovu (viz sekce 2.1).
- Hodnoty lze v Nastavení kdykoliv změnit.

## 4. Vícejazyčnost

- Aplikace musí podporovat více jazyků (minimálně čeština a angličtina, ideálně i slovenština a němčina).
- **Každý jazyk musí mít vlastní samostatný překladový soubor** (např. `cs.json`, `en.json`, `sk.json`, `de.json`) – žádné míchání jazyků v jednom souboru ani v kódu natvrdo (hardcoded texty jsou zakázané, vše jde přes i18n systém).
- Přepínač jazyka musí být dostupný odkudkoli v aplikaci (např. ikonka vlajky/globu v hlavičce).
- Výchozí jazyk se nastaví podle jazyka prohlížeče, s možností ruční změny.

## 5. Design a vizuální styl

- **Design musí být unikátní a originální – nepoužívej běžné šablony, generické UI kity ani "default" vzhled běžných frameworků/komponentových knihoven.** Cílem je, aby appka vypadala jako vlastní, nezaměnitelný produkt, ne jako další klon typické šablony z internetu.
- Styl: **"rychle a zběsile" (Fast & Furious) vibe** – ale zároveň moderní, čistý a přehledný, ne přeplácaný.
- Tmavý motiv (dark mode) jako základ – černá/tmavě šedá základna, asfaltové textury nebo jemné gradientové pozadí.
- Výrazné akcentové barvy: sytá oranžová, červená, případně žlutý neon – použité cíleně (tlačítka, zvýraznění částek, progress bary), ne plošně.
- Tučné, dynamické, mírně zkosené/sportovní písmo pro nadpisy a čísla (částky musí být na první pohled čitelné a výrazné).
- Jemné detaily inspirované závodním světem: rychlostní linky, jemné animace při přechodech, "nitro" styl progress baru při výpočtu, ikonka auta/trasy.
- Animace používat střídmě – mají podtrhnout dynamiku, ne zpomalovat nebo rušit používání.
- I přes výrazný styl musí být UI **maximálně přehledné** – uživatel musí na první pohled vidět: kam se jede, kolik to stojí, kolik platí on sám.

## 6. Responzivita

- Aplikace se bude používat **převážně na mobilu** (lidé v autě) → mobilní zobrazení je prioritní:
  - velká dotyková tlačítka,
  - jednoduchá navigace na pár kliknutí (vytvořit trip → vyplnit údaje → ukončit → zaplatit),
  - QR kód po vygenerování musí být na mobilu dostatečně velký a dobře čitelný kamerou.
- Zároveň vytvoř **plnohodnotné desktopové zobrazení** (např. pro plánování cesty dopředu na počítači) – využij širší plochu např. pro přehlednější rozložení formuláře a souhrnu nákladů vedle sebe, dashboard se statistikami apod. (žádná vizuální mapa se nezobrazuje, viz sekce 2.1).
- Použij přístup mobile-first responzivní design (breakpointy pro mobil, tablet, desktop).

## 7. Doplňující nápady a vylepšení (zvaž a případně zapracuj)

- **Sdílení souhrnu tripu odkazem nebo QR kódem** – po ukončení jízdy lze poslat statický souhrn (trasa, částky) ostatním spolujezdcům, aniž by museli appku sami ovládat (vzhledem k tomu, že appka je bez backendu, nejde o živé sdílení v reálném čase, ale o odeslání hotového výsledku).
- **Více řidičů / střídání aut** – možnost rozdělit náklady i mezi více vozidel v konvoji.
- **Doplňkové náklady** – kromě paliva možnost přidat mýtné, parkovné, případně jídlo/občerstvení do společného účtu.
- **PWA (Progressive Web App)** – možnost nainstalovat aplikaci na plochu telefonu a fungovat částečně offline (např. když je trasa mimo signál).
- **Zaokrouhlování částek** – možnost zaokrouhlit výslednou částku na rozumné číslo (např. na celé koruny).
- **"Mission complete" souhrnná obrazovka** – po ukončení tripu efektní, ale přehledná shrnující obrazovka s trasou, ujetými km a finálním rozpočtem, laděná do stylu závodního stylu aplikace.

## 8. Doporučený technický přístup

- Frontend: moderní framework (např. React/Next.js v plně statickém exportu, nebo Vue/Vite), s i18n knihovnou pro překlady (např. i18next).
- Mapy/výpočet vzdálenosti: **OpenRouteService** (zdarma, bez nutnosti platební karty) – geocoding endpoint pro vyhledávání/autocomplete adres a directions endpoint pro výpočet vzdálenosti trasy. Žádná vizuální mapa se nezobrazuje, jde čistě o výpočet na pozadí, takže není potřeba žádná knihovna na zobrazení mapy (Leaflet apod.) ani placená API typu Google Maps.
- Generování QR kódu: knihovna pro generování QR kódů na straně klienta (čistě v prohlížeči, bez externího API), výstup ve formátu odpovídajícím české QR platbě (SPAYD).
- Ukládání dat: aplikace nemá vlastní backend ani databázi – veškerá data (nastavení, historie jízd, rozpracovaný trip) se ukládají pouze lokálně v prohlížeči uživatele (`localStorage`).

## 9. Technické omezení – pouze statický hosting

- Aplikace musí být **čistě statická (frontend-only)** – žádný vlastní backend server, žádná serverová databáze, žádné serverless funkce nutné pro základní chod – tak, aby šla bez úprav nasadit přímo na **GitHub Pages** nebo **Netlify** (případně Vercel/Cloudflare Pages) a nebylo potřeba žádné VPS ani vlastní server.
- Build musí vygenerovat čistě statické soubory (HTML/CSS/JS), které lze nahrát do libovolného static hostingu.
- Vyhni se čemukoliv, co by vyžadovalo vlastní server za běhu (server-side rendering vyžadující Node server, API routes vyžadující backend apod.) – pokud framework (např. Next.js) něco takového nabízí, použij jeho statický export/build režim.

## 10. Spuštění a lokální server

- Aplikaci vytvoř jako standardní Node.js projekt s `package.json` a definovanými skripty pro instalaci a spuštění (např. `npm install` a `npm run dev` / `npm start`).
- Po spuštění `npm install` se musí vygenerovat složka `node_modules` se všemi potřebnými závislostmi, aby šlo projekt rovnou spustit lokálně.
- Přilož stručný návod (např. v `README.md`), jak projekt nainstalovat a spustit na lokálním serveru (požadovaná verze Node.js, příkazy pro instalaci, spuštění vývojového serveru, build pro produkci a nasazení na GitHub Pages / Netlify).

## 11. Co má AI vytvořit

Na základě výše uvedeného zadání vytvoř kompletní funkční webovou aplikaci včetně:
- responzivního UI (mobil + desktop) ve výše popsaném vizuálním stylu,
- plně funkční logiky výpočtu nákladů (vč. dynamického přepočtu při odebírání/přidávání osob) a generování platebního QR kódu (CZK),
- jednoduchého přihlášení a sekce Nastavení podle bodu 3,
- struktury pro vícejazyčnost se samostatnými soubory pro každý jazyk (čeština a angličtina jako minimum),
- čistě statické struktury nasaditelné na GitHub Pages / Netlify,
- čistého, dobře komentovaného a snadno rozšiřitelného kódu.