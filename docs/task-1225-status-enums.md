# #1225 — jednotné stavy platby a bookingu

Scénář `pidlitacka-task-1225-status-consistency` je spojený s
[GitLab #1225](https://gitlab.com/operator-ict/mobility/mos-pid/pid-litacka-aplikace/pid-litacka-2.0/pid-litacka-2.0-general/-/work_items/1225)
a polem `klikatko_tests` v Obsidian tasku 1225. Pack je registrovaný v projektu PidLitacka.
Doklad zachycuje lokální pracovní verzi před commitem; skutečné nasazení se tím nepotvrzuje.

## Provedený test 30. 9. 2026

- Klikátko `http://127.0.0.1:5096`, prostředí `pidlitacka-local-1225` / LOCAL #1225 — kontrakt,
  skutečný proxy target `http://127.0.0.1:5125`.
- PID BE `feature/1225-payment-booking-status-enums`, base/HEAD
  `b7e0c15c76686740736c63105e89b6b17446fa40` + necommitnutá implementace #1225.
  Checkout: `C:/Users/op3782/source/repos/.codex-worktrees/pid-litacka-2.0-backend-1225-payment-status-enums`.
- Automatický runner používající skutečné assertion funkce Klikátka: **62/62 PASS**,
  finální běh 12:54:03–12:54:04 UTC (14:54 Europe/Prague), po opravě spouštění hostu z kořene Klikátka.
- Následný běh přímo tlačítkem **Spustit do kroku** v UI: **62/62 PASS**, 14:57:07–14:57:08 Europe/Prague.
  Log `Auto run finished` má `targetStep: 62`, `failedSteps: []`; Tester ukazuje
  `Hotovo: 62/62 kroků prošlo.`
- Testy Klikátka: **139 PASS / 0 FAIL**, včetně čtyř pozitivních/negativních kontrol nového packu.
  Ty prokazují odmítnutí uppercase a číselných enumů, explicitního null místo vynechaného pole,
  nesprávného recovery HTTP statusu a vzdáleného proxy targetu.

## Co pokrývá

| Povrch | Kontrola |
|---|---|
| Kartová iniciace + GET payment | Sedm business stavů + unknown, empty, null; stejné nested booking tokeny. |
| Wallet process | Stejných deset případů, jednotný `status` a `booking.paymentState`. |
| Saved-card + retry | Pět dvojic; skutečná recovery služba vyvolá 409 a mapuje `paymentStatus`, null pole vynechá. |
| Apple Pay / Google Pay iniciace | Obě response používají `inProgress`. |
| Create/detail booking | `prebooked`, `confirmed`, `fulfilled`, `cancelled`; nullable `paymentState` chybí. |
| Historie | Všechny tokeny a stránkování (`total: 14`, `limit: 20`, `offset: 0`). |

Business payment tokeny: `created`, `inProgress`, `paid`, `canceledByUser`,
`canceledByGateway`, `inRefundProcess`, `refunded`. Unknown/empty nenullový stav
vrací `undefined`; absence nullable stavu vynechává příslušné pole.

## Rozsah důkazu a opakování

Host běží nad skutečným Program composition, JWT autorizací, controllery, handlery,
mapperem a MVC/recovery serializery PID BE. Tickets API odpovědi, uložená karta,
rezervace a vedlejší služby jsou řízené fixtures. Test tedy prokazuje HTTP kontrakt PID BE,
nikoli skutečný nákup, stavové přechody Tickets, vydání jízdenky, platbu či refundaci.
GD Pay, INT a FE emulátor nebyly volány. Do produkčního BE nebyl přidán testovací endpoint.

Spuštění hostu, výběr packu/prostředí a opakování:
[README hostu](../tools/task-1225-contract-host/README.md).
Před opakováním celého packu restartuj host: stejné saved-card klíče mají rezervace v paměti.

Přenositelné doklady uložené s packem (bez přihlašovacího JWT):

- [UI protokol](test-results/task-1225/ui-report.json) — všechny response přečtené z viditelného logu UI a závěrečný výsledek.
- [Runner protokol](test-results/task-1225/runner-report.json) — všech 62 HTTP response.
- [Obrazovka výsledku](test-results/task-1225/ui-62-pass.png) — 62/62.

Původní lokální doklady (ignorované Gitem):

- `public/local/task-1225/2026-09-30T12-54-03-094Z-report.json` — všech 62 HTTP response runneru.
- `public/local/task-1225/ui-report.json` — všechny response přečtené z viditelného logu UI a závěrečný výsledek.
- `public/local/task-1225/ui-62-pass.png` — obrazovka výsledku 62/62.

## Soubory k commitu v Klikátku

- `docs/task-1225-status-enums.md`
- `docs/test-results/task-1225/ui-report.json`
- `docs/test-results/task-1225/runner-report.json`
- `docs/test-results/task-1225/ui-62-pass.png`
- `public/scenarios/index.json`
- `public/scenarios/pidlitacka/index.json`
- `public/scenarios/pidlitacka/task-1225-status-enums.json`
- `test/task-1225-status-enums-scenario.test.js`
- `tools/run-task-1225.cjs`
- `tools/task-1225-contract-host/Task1225ContractHost.csproj`
- `tools/task-1225-contract-host/Program.cs`
- `tools/task-1225-contract-host/README.md`

V projektovém manifestu již před tímto během existovala rozpracovaná registrace #1200;
její soubory i registrace zůstaly zachované a nejsou součástí výše uvedeného nového rozsahu.
Přenositelné kopie dokladů jsou součástí změny; provozní `public/local/`, build output
a Obsidian nejsou součástí commitu Klikátka.

Návrh commit message: `test: ticket payment status contract`

## Opakování po review #1225

30. 9. 2026 16:31 Europe/Prague: znovu sestavený host nad BE HEAD 94290dba + review diff,
stejný pack a prostředí. Runner **62/62 PASS**; [sanitizovaný protokol](test-results/task-1225/review-runner-report.json).
Zachovány všechny původní response tokeny, nullable absence a recovery. Nový enum ve filtru
bookings-search a jeho převod na upstream ověřuje BE HTTP/OpenAPI sada (v celé solution
4 671 PASS / 0 FAIL / 1 SKIP externího HSM). Tento opakovaný běh byl proveden runnerem;
původní UI doklad 14:57 zůstává výše samostatným dokladem dřívější revize.
