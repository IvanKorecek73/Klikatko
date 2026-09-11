# Demo Harness

Obecné klikátko pro ruční a smoke testování API scénářů bez zásahu do testovaného backendu.

Pro pokračování na jiném zařízení použij [předání stavu z 11. 9. 2026](docs/handoff-2026-09-11.md),
včetně správné větve, lokální konfigurace a závislostí emulátorových scénářů.

## Spuštění

### PowerShell

```powershell
.\Start-Harness.ps1
```

### Node.js

```cmd
Start-Harness-Node.cmd
```

nebo jednoduše:

```cmd
Start-Klikatko.cmd
```

Volitelně lze předat výchozí proxy target:

```cmd
Start-Klikatko.cmd https://localhost:7261
```

Po startu se otevře:

- `http://127.0.0.1:5096`

Proxy target už pak lze přepínat přímo v UI přes:

- `Projekt`
- `Test pack`
- `Prostředí`

## Umístění

Klikátko je samostatný mini-projekt v:

- `C:\Users\op3782\source\repos\klikatko`

## Připnutí do Windows lišty

Nejjednodušší cesta:

1. vytvořit zástupce na `Start-Klikatko.cmd`
2. zástupce přejmenovat třeba na `Klikátko`
3. zástupce připnout na hlavní panel Windows

Tím získáte jedno kliknutí pro spuštění harnessu.

## Princip

- `public/app.js`, `public/index.html`, `public/styles.css`
  - obecný engine
- `public/scenarios/index.json`
  - seznam projektů
- `public/scenarios/<projekt>/index.json`
  - seznam packů pro vybraný projekt
- `public/scenarios/<projekt>/<pack>.json`
  - konkrétní scénáře a formuláře

## Struktura manifestu

### 1. Seznam projektů

`public/scenarios/index.json`

```json
{
  "version": 2,
  "defaultProjectId": "ticket-service",
  "projects": [
    {
      "id": "ticket-service",
      "name": "Ticket Service",
      "manifest": "ticket-service/index.json",
      "defaultBaseUrl": "/api"
    }
  ]
}
```

### 2. Seznam packů projektu

`public/scenarios/pidlitacka/index.json`

```json
{
  "version": 1,
  "defaultPackId": "pidlitacka-feature-729",
  "packs": [
    {
      "id": "pidlitacka-feature-729",
      "name": "PidLitacka - feature 729",
      "file": "feature-729-overeni-existence-uzivatele.json"
    }
  ]
}
```

### 3. Samotný pack

`public/scenarios/pidlitacka/feature-729-overeni-existence-uzivatele.json`

```json
{
  "version": 1,
  "name": "PidLitacka - feature 729",
  "scenarios": []
}
```

## Jak přidávat nové PidLitacka scénáře

1. Přidat nebo upravit pack v `public/scenarios/pidlitacka/`.
2. Zapsat pack do `public/scenarios/pidlitacka/index.json`.
3. V UI vybrat projekt `PidLitacka`.
4. V UI vybrat příslušný `Test pack`.

## Důležité pravidlo

Klikátko nesmí vyžadovat úpravy testovaného backendu jen kvůli své existenci.

To znamená:

- nové use case nejdřív zkoušet pokrýt přes existující veřejné nebo interní API daného řešení
- engine upravovat jen tehdy, když jde o obecně použitelnou schopnost
- business logika patří do JSON packů, ne do `app.js`

## Opakování mobilních testů nové a uložené karty (#1109)

Spusťte postupně dvě samostatná workflow: **Jízdenky – platba novou kartou a její uložení** a **Jízdenky – platba uloženou kartou**. Použijte vyhrazený platební účet a ověřené lokální sandboxové prostředí.

První workflow má po přihlášení přípravný krok **Vymazat všechny uložené karty testovacího účtu**. Moderátor v druhé záložce se stejným účtem a prostředím použije existující scénář **Jízdenky - odstranit testovací uloženou kartu** z packu tasku 1111. Zopakuje načtení, výběr a odstranění pro každou kartu; pokračuje teprve po čerstvém `GET /v1/accounts/me/saved-cards` s HTTP 200 a `[]`. Jde o lokální soft-delete uložených položek, bez revokace tokenu u brány. V emulátoru během přípravy nic nezadávejte.

První nákup musí splnit platbu i uložení právě jedné nové karty. Uchovejte její `savedCardId` a vazbu na úspěšný booking/payment. **Mezi nákupy cleanup neopakujte.** Pro navazující sandboxový test zadejte koncovku `0006`, počet `1` a pozici `1`; skutečně použité `savedCardId` musí odpovídat kartě uložené prvním nákupem. Druhé workflow si před platbou stále samostatně ověřuje existenci karty.

Platební údaje ani testovací OTP při automatických akcích ručně nevyplňujte. Řiďte se oddělenými kroky pro otevření brány, vyplnění a odeslání. Obě platby ověřte jako Paid/Fulfilled s neaktivovanými jízdenkami a skutečným návratem; samotné dokončení prezentačních kroků tyto kontroly nenahrazuje.
