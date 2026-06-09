# Demo Harness

Obecné klikátko pro ruční a smoke testování API scénářů bez zásahu do testovaného backendu.

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

- `http://localhost:5096`

Proxy target už pak lze přepínat přímo v UI přes:

- `Projekt`
- `Test pack`
- `Prostředí`

## Doporučené umístění

Klikátko je už dnes samostatný mini-projekt. Pokud ho budeme chtít úplně oddělit od Tickets repo, nejbezpečnější je:

1. zkopírovat celý adresář `integration/demo-harness`
2. ověřit spuštění v nové lokaci
3. teprve potom případně smazat původní kopii

Doporučená cílová složka:

- `C:\Users\op3782\source\repos\klikatko`

nebo obecnější název:

- `C:\Users\op3782\source\repos\api-demo-harness`

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
