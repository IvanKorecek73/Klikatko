# Lokální kontraktní test tasku 1225

Testuje veřejný JSON skutečného PID BE z vybraného checkoutu. `CustomWebApplicationFactory`
spouští celý Program v režimu Testing: skutečné controllery, handlery, mapper, MVC/HTTP serializery
a `TicketThreeDsReturnService`. Tickets API odpovědi, karta, rezervace a vedlejší služby jsou fixtures.
Nevolá Tickets runtime, GD Pay, INT ani externí refundaci; neověřuje FE emulátor.

Host naslouchá pouze na `127.0.0.1:5125`, data jsou v paměti a JWT používá lokální testovací klíč.
Za běhu se nemění soubory ani konfigurace PID BE. Checkout bez enumového wallet statusu odmítne.

## Spuštění

Z kořene Klikátka (.NET 10, obnovené závislosti PID BE):

```powershell
dotnet run --project tools/task-1225-contract-host/Task1225ContractHost.csproj -p:PidLitackaRepositoryRoot="C:/Users/op3782/source/repos/.codex-worktrees/pid-litacka-2.0-backend-1225-payment-status-enums"
```

Ve druhém terminálu spusť Klikátko s místním cílem:

```powershell
$env:TICKET_SERVICE_BASE_URL = "http://127.0.0.1:5125"
node server.js
```

V UI `http://127.0.0.1:5096` vyber PidLitacka → #1225: jednotné stavy platby a bookingu →
LOCAL #1225 — kontrakt. První krok připraví syntetické přihlášení. Pack má 62 kroků.
Scénář nepoužívej pro živé objednávky; statické IDs označují řízené fixtures.

Stejný pack lze provést automaticky přes proxy a assertion funkce skutečného Klikátka:

```powershell
node tools/run-task-1225.cjs
```

Runner načítá engine z `public/app.js`, chrání skutečný proxy target a nepřepisuje response.
Výsledky všech HTTP kroků ukládá do ignorovaného `public/local/task-1225/`, přihlášení vynechává.
Kontroluje přesné tokeny i nepřítomnost nullable polí při absenci platby; recovery vzniká
opakovaným saved-card požadavkem se stejným klíčem. Při restartu hostu rezervace zmizí;
před dalším celým během host restartuj, aby první saved-card krok nebyl již recovery.

Přehled výsledku a vazba na task: `docs/task-1225-status-enums.md` a Obsidian task 1225.
Přenositelné doklady provedeného běhu jsou v `docs/test-results/task-1225/`.
