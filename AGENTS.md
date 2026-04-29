# AGENTS.md

## Účel projektu

Tento repozitář obsahuje **Klikátko** - samostatný lightweight harness pro ruční a smoke testování API scénářů.

Projekt je oddělený od původního TicketService repozitáře. Veškerý další vývoj Klikátka má probíhat zde:

`C:\Users\op3782\source\repos\klikatko`

Nepoužívat ani neupravovat starou kopii v `tickets/integration/demo-harness`, pokud uživatel výslovně neřekne jinak.

## Hlavní princip

Klikátko je obecný engine + konfigurovatelné testovací packy.

- Engine:
  - `public/app.js`
  - `public/index.html`
  - `public/styles.css`
  - `server.js`
- Konfigurace projektů:
  - `public/scenarios/index.json`
- Packy pro konkrétní projekt:
  - `public/scenarios/<project>/index.json`
  - `public/scenarios/<project>/<pack>.json`

Nové API scénáře se mají přidávat hlavně jako JSON packy. Do engine sahat jen tehdy, když je potřeba obecná funkce použitelná i pro další scénáře.

## Projekty a prostředí

Klikátko podporuje více projektů:

- `Ticket Service`
- `PidLitacka`

Projekt `PidLitacka` je teď hlavní aktivní směr vývoje.

Prostředí jsou definovaná v `public/scenarios/index.json`. `LOCAL` má zůstat bezpečný default, aby se omylem nespouštěly scénáře proti vzdálenému prostředí.

Aktuálně:

- `LOCAL` pro PidLitacka: `https://localhost:7261`
- `INTEGRAČNÍ` pro PidLitacka: `https://pidl2-backend.int.pidlitacka.cz/`

Badge prostředí:

- `LOCAL` = lokální vývoj
- `INT` = integrační prostředí, warning styl
- `PROD` = ostré prostředí, výrazný alert

## Auth pravidla

Auth je konfigurovatelná per projekt.

PidLitacka používá login flow:

- `POST /v1/auth/login`
- `POST /v1/auth/token`
- `POST /v1/auth/logout`

Session se ukládá per projekt + prostředí. Scénáře, které vyžadují přihlášení, používají `requiresAuth: true`.

Heslo se nemá ukládat do localStorage, pokud není výslovně důvod to změnit.

Ticket Service historicky podporuje ruční JWT režim.

## Scénáře a smoke

Scénáře mohou být:

- plně automatické, vhodné pro smoke
- ruční, návodné, mimo smoke

Ruční scénáře označovat:

```json
{
  "smoke": false,
  "manualInputRequired": true
}
```

`smoke: false` není chyba. Znamená to, že scénář vyžaduje ruční vstup, e-mail, token, platební bránu, perzistentní data nebo jinou interakci.

Smoke run má běžet jen nad scénáři, které jsou pro to vhodné.

## Formuláře

Formuláře jsou stejně důležité jako scénáře.

Když se přidá nový relevantní request krok, měl by být použitelný i samostatně v záložce `Formuláře`.

U polí preferovat lidské popisky, placeholdery a výběry místo syrových technických hodnot, ale technickou hodnotu requestu zachovat.

Technická pole, která uživatel nemá řešit, označit:

```json
{ "hidden": true }
```

## Výběr položky ze seznamu

Klikátko podporuje obecný vzor:

1. načíst seznam
2. v mobilu vybrat položku
3. uložit její hodnotu do contextu
4. použít ji v dalším kroku

Používat pro:

- uložená vozidla
- oblíbené zóny
- platební karty
- další podobné seznam -> výběr -> akce flow

Uživatel nemá opisovat interní ID, pokud ho jde vybrat z předchozího response.

## Mobilní náhled

Mobil má působit jako čitelný testovací prototyp, ne jako Swagger.

Pravidla:

- business data zobrazovat hezky jako karty
- technické URL, hlavičky a syrové requesty patří do logu, ne do mobilu
- kroky bez vstupních parametrů zobrazit jako `Bez vstupních parametrů`
- interní ID skrývat, pokud nejsou pro testera užitečná
- datum a čas formátovat čitelně pro českého uživatele
- barvy zobrazovat jako swatch, ne jen jako hex
- klikací chipy vizuálně odlišit a použít pro mapu nebo externí odkazy

Speciální renderery už existují hlavně pro PidLitacka parking:

- uložená vozidla
- oblíbené zóny
- návrhy lokalit
- aktivní parking sessions
- parking history
- založení parkování a odkaz na platební bránu
- výpočet ceny parkování multi

## Tagování

Tagy mají testerovi pomáhat najít scénář. Preferovat business štítky místo jedné pevné kategorie.

U parkingu používat zejména:

- `Parkování`
- `Vozidla`
- `Zóny`
- `Lokality`

Tag `Negativní` používat jen pro scénáře, které záměrně ověřují správné odmítnutí nebo chybu. Nepoužívat ho jen proto, že scénář používá `DELETE`.

## PidLitacka pravidla

Do PidLitacka backendu kvůli Klikátku nesahat.

Klikátko má testovat existující API přes veřejné endpointy a lokální proxy. Nepřidávat pomocné endpointy do PidLitacka jen pro harness.

Když endpoint vrací jiný status nebo response shape, nejdřív upravit scénář/rendering podle reálného API, pokud nejde o jasnou chybu backendu.

## Git

Tento repozitář má vlastní remote:

`https://github.com/IvanKorecek73/Klikatko.git`

Aktivní větev je `main`.

Před změnami vždy ověřit, že se pracuje v:

`C:\Users\op3782\source\repos\klikatko`

Po ucelené změně je vhodné commitnout malý logický commit.

## Styl práce

Preferovat malé bezpečné kroky:

- změna scénáře
- validace JSONu
- drobná úprava rendereru
- refresh UI

Nepřepisovat velké části engine, pokud stačí malá cílená změna.

Když se rozbije výběr projektu nebo inicializace UI, nejdřív hledat syntaktickou nebo duplicitní chybu v `public/app.js`.

