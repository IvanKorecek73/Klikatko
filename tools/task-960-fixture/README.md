# Task 960 / 1140 — lokální fixture

Tento pomocník připraví v izolované databázi `tickets-smoke-960` zakoupenou, dosud neaktivovanou
jízdenku. Nahrazuje pouze chybějící nákup z tasku 957; samotná aktivace musí proběhnout přes
Klikátko → PID Lítačka BE → Ticket Service API.

Zdroj fixture je uložen přímo v repozitáři Klikátka. Výchozí `ProjectReference` očekává
repozitář `tickets` jako sourozence repozitáře `klikatko`; jinou cestu lze předat MSBuild
property nebo proměnnou prostředí `TicketsRepositoryRoot`.

Nástroj je bezpečnostně omezený na `localhost:55432/ticket_service_dev` a nelze jej omylem spustit proti
INT, PRE ani PROD. Projekt Tickets používá pouze jako kompilovanou referenci a žádný jeho soubor nemění.

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

Každý běh vytvoří nový fulfillment ve stavu `AVAILABLE` a vypíše jeho ID jako JSON. Testovací produkt
se založí pouze při prvním použití dané varianty a má prezentační podtyp `adult`, aby fixture pokrývala
i fulfillment kontrakt tasku 1067. Data patří výhradně do izolovaného Docker volume.
