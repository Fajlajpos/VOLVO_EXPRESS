# PAY WAY - Dělení nákladů na jízdu autem & generátor QR plateb

PAY WAY je moderní, čistě statická (frontend-only) webová aplikace určená pro řidiče a jejich party, která usnadňuje spravedlivé rozdělení nákladů na palivo a generuje standardní české platební QR kódy (SPAYD standard) přímo v prohlížeči.

Aplikace je navržena s **"Fast & Furious"** (Rychle a zběsile) sportovním designem v tmavém režimu s neonově oranžovými a azurovými akcenty, rychlostními linkami a tachometrickými progress bary.

## 🚀 Klíčové vlastnosti

1. **Vytvoření jízdy & Autocomplete:**
   - Zadejte odkud, kam a libovolný počet zastávek (průjezdních bodů).
   - Napojení na bezplatné mapové API **OpenRouteService** automaticky doplňuje adresy a počítá celkovou vzdálenost (na pozadí, bez zobrazení vizuální mapy).
   - Možnost přepnout na "Tam a zpět" (zdvojnásobí vzdálenost cesty) nebo zadat kilometry ručně (pokud nemáte API klíč).

2. **Dynamické rozdělení nákladů:**
   - Automatický výpočet celkové ceny z průměrné spotřeby vozidla, ceny a typu paliva.
   - Možnost spravovat seznam spolujezdců v garáži (Nastavení) a zaškrtnout ty, kteří jedou.
   - **Ruční úprava částky (Override):** Pokud u některého spolujezdce upravíte částku ručně, aplikace okamžitě automaticky přepočítá a rozdělí zbylou cenu mezi ostatní neupravené spolujezdce tak, aby celková cena jízdy vždy přesně seděla.

3. **Platby přes QR kódy (CZK):**
   - Po ukončení jízdy vygeneruje platební QR kódy ve formátu **QR Platba (SPAYD)**.
   - Vygeneruje **jeden sdílený QR kód** s rovným podílem pro spolujezdce bez ručních úprav a **samostatný individuální QR kód** pro každého spolujezdce s ruční úpravou.
   - Obsahuje tlačítko **"Sdílet"** (využívá nativní Web Share API pro mobilní telefony, s kopírováním textu do schránky jako fallback) a tlačítko **"Uložit QR kód"** (stáhne QR kód jako PNG obrázek do galerie/zařízení).

4. **Odolnost proti obnovení stránky (Autosave):**
   - Rozpracovaná jízda se průběžně a automaticky ukládá do `localStorage`, takže o data nepřijdete při náhodném refreshi nebo ztrátě mobilního signálu.

5. **Vícejazyčnost (i18n):**
   - Aplikace plně podporuje přepínání jazyků: **Čeština (CS), English (EN), Slovenčina (SK), Deutsch (DE)**. Každý jazyk má svůj samostatný překladový soubor.

---

## 🛠️ Instalace a lokální spuštění

Projekt je vytvořen pomocí **Vite**, **React 19** a **TypeScript**.

### Požadavky
- **Node.js** (doporučena verze v18 nebo novější)
- **npm** (součástí Node.js)

### Krok za krokem

1. **Instalace závislostí:**
   ```bash
   npm install
   ```

2. **Nastavení přihlašovacích údajů:**
   Vytvořte v kořenovém adresáři soubor `.env` (zkopírujte šablonu z `.env.example`):
   ```bash
   cp .env.example .env
   ```
   A doplňte požadovaný e-mail a heslo:
   ```env
   VITE_LOGIN_EMAIL=driver@payway.cz
   VITE_LOGIN_PASSWORD=racing-fuel
   ```
   *Upozornění: Jelikož se jedná o čistě statickou frontend aplikaci, tyto hodnoty se při buildu zabalí přímo do JS souborů. Slouží to jako jednoduchá clona proti běžným návštěvníkům, nikoliv jako neprolomitelné zabezpečení.*

3. **Spuštění vývojového serveru:**
   ```bash
   npm run dev
   ```
   Aplikace bude dostupná v prohlížeči na adrese `http://localhost:5173/`.

4. **Produkční build:**
   Chcete-li sestavit aplikaci do čistě statických souborů pro produkční hosting (např. GitHub Pages, Netlify, Vercel):
   ```bash
   npm run build
   ```
   Výsledné soubory se vygenerují do složky `dist/`.

---

## 🗺️ Jak získat OpenRouteService API Klíč?

Aby fungovalo automatické vyhledávání adres a výpočet kilometrů, je potřeba v sekci **Nastavení** uložit bezplatný API klíč:
1. Zaregistrujte se zdarma na webu [openrouteservice.org](https://openrouteservice.org/).
2. V administraci přejděte do sekce **Tokens** a vygenerujte nový token (typ: *Free*, název např. *PAY WAY*).
3. Vygenerovaný klíč zkopírujte a vložte do pole **OpenRouteService API klíč** v sekci Nastavení v aplikaci a klikněte na **Uložit nastavení**.
4. Klíč se bezpečně uloží do vašeho `localStorage` v prohlížeči.

*Pokud klíč nemáte, aplikace vás upozorní a umožní vám zadávat ujeté kilometry ručně, takže je stále 100% použitelná.*

---

## ⚙️ Technická architektura

- **Frontend:** React + TypeScript + Vite (statické generování bez SSR/backendu).
- **QR kódy:** Knihovna `qrcode` generuje QR kód přímo na `<canvas>`, ze kterého následně extrahuje PNG data URL pro stažení.
- **Formát QR Platby:** Převod českého formátu čísla účtu (s prefixem a lomítkem banky) na mezinárodní standard IBAN (výpočet modulo 97 v čistém JS pro zamezení přetečení čísla).
- **Úložiště:** Všechna uživatelská data (nastavení účtu, výchozí spotřeby, seznam spolujezdců, historie jízd a rozpracovaný stav) jsou ukládána lokálně v prohlížeči (`localStorage`).
