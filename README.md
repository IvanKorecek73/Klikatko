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

## Okno Android emulátoru

Pro samostatné emulátorové testy ve Windows spouštějte zařízení přes:

```powershell
.\Start-Emulator.ps1
```

Spouštěč před startem nastaví polohu a měřítko okna podle pracovní plochy primárního
monitoru, včetně rezervy na rám a ovládací lištu. Nemění rozlišení Androidu ani data
aplikace. Používá 4 GB RAM a studený start bez snapshotu. Výpočet lze prohlédnout
bez změny nastavení nebo startu pomocí `-Preview`; jiné AVD zvolte přes `-AvdName`.
Při již běžícím emulátoru skončí bez změny, aby nevznikla druhá instance ani se
nepřepsala konfigurace pod běžícím procesem. Logy jsou v ignorovaném
`public/local/emulator/`.

Při chybě paměti start neopakovat ve smyčce; nejprve restartovat počítač.

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

## Validace pásem na INT (#1145)

Použijte pack **PidLitacka – #1145: validace pásem na INT** a vedené ruční workflow
**INT – #1145: Praha a výběr pásem v aplikaci** (kategorie Prezentace).
[Postup, potřebné jízdenky a protokol](docs/task-1145-int.md) rozlišují kontrolu
katalogu, přímé API testy a skutečné ověření pickeru v INT aplikaci.
Aktivační scénáře spotřebují výslovně vybrané AVAILABLE kusy; nenakupují ani neplatí.
Původní lokální pack #1145 zůstává pro izolované fixture testy.

## Opakování mobilních testů nové a uložené karty (#1109)

Spusťte postupně dvě samostatná workflow: **Jízdenky – platba novou kartou a její uložení** a **Jízdenky – platba uloženou kartou**. Použijte vyhrazený platební účet a ověřené lokální sandboxové prostředí.

První workflow má po přihlášení přípravný krok **Vymazat všechny uložené karty testovacího účtu**. Moderátor v druhé záložce se stejným účtem a prostředím použije existující scénář **Jízdenky - odstranit testovací uloženou kartu** z packu tasku 1111. Zopakuje načtení, výběr a odstranění pro každou kartu; pokračuje teprve po čerstvém `GET /v1/accounts/me/saved-cards` s HTTP 200 a `[]`. Jde o lokální soft-delete uložených položek, bez revokace tokenu u brány. V emulátoru během přípravy nic nezadávejte.

První nákup musí splnit platbu i uložení právě jedné nové karty. Uchovejte její `savedCardId` a vazbu na úspěšný booking/payment. **Mezi nákupy cleanup neopakujte.** Pro navazující sandboxový test zadejte koncovku `0006`, počet `1` a pozici `1`; skutečně použité `savedCardId` musí odpovídat kartě uložené prvním nákupem. Druhé workflow si před platbou stále samostatně ověřuje existenci karty.

Platební údaje ani testovací OTP při automatických akcích ručně nevyplňujte. Řiďte se oddělenými kroky pro otevření brány, vyplnění a odeslání. Obě platby ověřte jako Paid/Fulfilled s neaktivovanými jízdenkami a skutečným návratem; samotné dokončení prezentačních kroků tyto kontroly nenahrazuje.

## Samostatné mobilní testy proti INT (#1109)

Pro nasazený INT použijte dvě samostatná workflow:

1. **INT – Jízdenky – platba novou kartou a její uložení** (13 kroků).
2. **INT – Jízdenky – platba uloženou kartou** (9 kroků).

V panelu Uživatel vyberte **INTEGRAČNÍ** a MOS PRE; profil workflow musí být
**BE INTEGRACE + MOS PRE**. INT workflow odmítne start, pokračování i emulátorovou
akci při jiném profilu, jiném zvoleném PID prostředí nebo přepsané cílové URL.
Adresa je `https://pidl2-backend.int.pidlitacka.cz/`. Výchozí LOCAL se nemění.

Emulátor musí mít aktuální **INT** APK s balíčkem
`cz.dpp.praguepublictransport.pidlitacka.int`, ne DEV APK s lokální URL. Z připraveného
FE checkoutu lze sestavit `flutter build apk --debug --flavor int --no-pub
--dart-define-from-file=../.env/int.json --dart-define=FLAVOR=int` v adresáři `app`.
Pokud INT Remote Config nákup jízdenek skrývá, připravený FE checkout podporuje
výslovný parametr `--dart-define=INT_EMULATOR_TICKET_TEST_FEATURES=true`. Zapíná
pouze záložku Jízdné a nákup jednotlivé jízdenky, jen pro debug + INT. Běžný build
bez parametru, release/profile i ostatní prostředí respektují původní pravidla.
Použití tohoto parametru zaznamenejte do reportu; neověřuje se tím rollout
feature flags. Po spuštění ověřte aktivní Jízdné ještě před cleanup.
To je lokální sestavení FE proti nasazenému INT BE; nelze je vydávat za ověření
oficiálně distribuovaného FE buildu. Zaznamenejte revizi i rozpracované FE změny a hash APK.

Před testem spusťte `./Select-EmulatorPaymentApp.ps1 -Environment INT`. Skript
povolí INT variantu a dočasně vypne DEV se zachováním dat. Obě totiž registrují
stejné schéma platebního návratu; současně aktivní varianty mohou vyvolat výběr
aplikace nebo návrat do nesprávného prostředí. Pro návrat k lokálním testům použijte
`./Select-EmulatorPaymentApp.ps1 -Environment LOCAL`. Skript nespouští emulátor,
neinstaluje APK ani nemaže data. Je-li emulátor vypnutý, nejprve použijte
`Start-Emulator.ps1`; při paměťové chybě start neopakujte, nejprve restartujte PC.

Testovací účet a kontrola uložení karty jsou stejné jako v lokální dvojici.
Cleanup ale musí proběhnout výhradně na **INT**, pouze u vyhrazeného testovacího účtu,
přes existující scénář `pidlitacka-ticket-1111-card-cleanup`. Před T01 doložte
prázdný seznam; mezi T01 a T02 kartu zachovejte a porovnejte přesné `savedCardId`.
Samotná příprava workflow neprovádí cleanup ani platbu. Před spuštěním plateb
ověřte, že INT používá GD Pay PRE sandbox a že máte správný účet.

INT nepotřebuje lokální backendy, DB seed ani Cloudflare tunel. Důkazy čerpejte
z veřejných autentizovaných API INT: identity, booking/payment, Paid/Fulfilled,
nová uložená karta a její skutečné použití v T02. Nepoužívejte lokální DB jako důkaz
INT výsledku. Návrat po 3DS musí být skutečný, jízdenky neaktivujte. Každý zásah do
platebních údajů nebo OTP mimo automatický krok zaznamenejte; takový běh nedokládá
plně automatický bankovní průchod. Statická kontrola a příprava nejsou úspěšné E2E.

Panel „Přihlásit / obnovit“ navíc zkouší přímou kontrolu MOS session v Redis.
Při nastavení vieweru na lokální Redis může po úspěšném INT přihlášení zobrazit
`MissingRedisKey`. Samotná tato zpráva není důkaz chyby INT přihlášení; jeho
funkčnost ověřte autentizovaným veřejným požadavkem (např. načtením uložených
karet). BE scénáře tohoto testu přímou kontrolu Redis nevyžadují.
