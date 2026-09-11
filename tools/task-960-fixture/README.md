# Task 960 / 1140 / 1145 — lokální fixture

Tento pomocník připraví v izolované databázi `tickets-smoke-960` zakoupenou, dosud neaktivovanou
jízdenku. Nahrazuje pouze chybějící nákup z tasku 957; samotná aktivace musí proběhnout přes
Klikátko → PID Lítačka BE → Ticket Service API.

Nástroj je bezpečnostně omezený na `localhost:55432/ticket_service_dev` a nelze jej omylem spustit proti
INT, PRE ani PROD. Projekt Tickets používá pouze jako kompilovanou referenci a žádný jeho soubor nemění.

Zdroj je uložen přímo v Klikátku; bridge jej standardně hledá zde. Jiný adresář lze nastavit
pomocí `TASK_960_FIXTURE_DIR`. Projekt očekává .NET SDK 10 a checkout `tickets` jako sourozence
checkoutu `klikatko`; jinou cestu lze předat proměnnou prostředí nebo MSBuild property
`TicketsRepositoryRoot`. Použij revizi Tickets odpovídající testovanému schématu a API.

## Spuštění

1. Získej JWT pro testovacího uživatele. Pokud obsahuje `sub`, použij jej; u PID Lítačka tokenu bez
   `sub` použij `identity_id`, ze kterého Ticket Service při autentizaci normalizovaný `sub` vytváří.
2. Spusť jednu z variant. Obalový skript bezpečně načte lokální connection string přímo z izolovaného
   Docker kontejneru a po doběhnutí jej odstraní z procesu:

```powershell
.\New-AvailableFulfillment.ps1 -UserId "<JWT subject>" -Variant fixed
.\New-AvailableFulfillment.ps1 -UserId "<JWT subject>" -Variant zonal
.\New-AvailableFulfillment.ps1 -UserId "<JWT subject>" -Variant mapped
```

- `fixed` vytvoří 30minutovou pražskou jízdenku bez volby pásem.
- `zonal` vytvoří 30minutovou jízdenku vyžadující souvislý blok tří pásem.
- `mapped` vytvoří produkt Tickets `1002` pro E2E ověření mapování z IPT produktu `867`.
- `prague-four` vytvoří produkt `1145004` s `zoneCount: 4`, povolenými pásmy P,0,B,1–13.
- `prague-seven` vytvoří produkt `1145007` s `zoneCount: 7`, povolenými pásmy P,0,B,1–13.
- `prague-sixteen` vytvoří produkt `1145016` s `zoneCount: 16`, povolenými pásmy P,0,B,1–13.
- `outer-four` vytvoří produkt `1145104` s `zoneCount: 4`, povolenými pásmy 1–13 (bez Prahy).

Varianty pro #1145 používá pack `klikatko/public/scenarios/pidlitacka/task-1145-prague-zone-count.json`.
Jde o syntetické produkty pro kontrolu počítání a výběru pásem; jejich cena 48 Kč a platnost 30 minut
neověřují skutečný katalog QA. Fixture nahrazuje nákup a platbu. Pack zvlášť ověřuje nabídku a rezervaci
přes veřejné PID BE API; platbu neprovádí. Pevná jízdenka má v databázi `ZoneCount = null`, který PID BE
v JSON vynechává; kontrola proto ověřuje její pevná `validZones` a ETD.

Každý běh vytvoří nový fulfillment ve stavu `AVAILABLE` a vypíše jeho ID jako JSON. Testovací produkt
se založí pouze při prvním použití dané varianty a má prezentační podtyp `adult`, aby fixture pokrývala
i fulfillment kontrakt tasku 1067. Data patří výhradně do izolovaného Docker volume.
