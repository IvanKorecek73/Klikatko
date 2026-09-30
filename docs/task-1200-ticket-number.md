# #1200 — kód nově koupené jízdenky

Pack `pidlitacka-task-1200-ticket-number` ověřuje přes veřejné endpointy PID BE čtyři kroky:
nacenění produktu `1200001`, vytvoření objednávky, načtení vydaného fulfillmentu z této
objednávky a detail téhož `fulfillmentId`. Detail musí obsahovat stejné `ticketNumber` jako
booking a hodnotu přenést jako desetinný řetězec.

## Lokální průchod 29. 9. 2026

- Prostředí: Klikátko `http://127.0.0.1:5096`, jeho API proxy na
  `http://localhost:5065`, izolovaný HTTP host obou pracovních verzí s PostgreSQL
  Testcontainerem. Tickets `feature/1200-ticket-number@807ce5c`, PID BE
  `feature/1200-ticket-number` nad `ee1b442d` s lokálním klientským balíčkem
  `0.1.0-task1200.local.1`.
- Výsledek: **4/4 kroků PASS**, všechny HTTP 200. Booking `11ebdd77-a70f-413c-9b81-0a0c534fb9a5`
  byl `FULFILLED`, potvrzená cena `0`. Detail fulfillmentu
  `fb9d5a7f-dc54-41f0-a204-c08cac95f741` vrátil `ticketNumber: "4294967300"`.
- Přesná odpověď detailu a protokol běhu jsou v lokálním testovacím adresáři
  `C:/Users/op3782/source/repos/tmp/task-1200-cross-service/` jako
  `detail-response.json` a `klikatko-report.json`. Přístupový token v nich není.
- Testy scénářů Klikátka: **135/135 PASS** příkazem `node --test --test-isolation=none`.

Produkt za 0 Kč prošel skutečnými endpointy pro nabídku a booking. TicketService takový
booking potvrdí bez platební brány; testovací host po odpovědi zavolal stejnou emisní službu,
kterou běžně volá worker, aby šel deterministicky načíst vydaný kus. Tento test proto
neověřuje GD Pay, RabbitMQ doručení, produkční autentizaci ani nasazení. Přihlášení Tickets
v izolovaném hostu používá testovací identitu; PID BE běží se svým JWT a testovací
náhradou HSM. Pro opakování na skutečném lokálním stacku musí být dostupný publikovaný
nulově naceněný produkt `1200001` a běžící worker.

## Soubory a spuštění

- Scénář: `public/scenarios/pidlitacka/task-1200-ticket-number.json`.
- Kontrola kontraktu scénáře: `node --test --test-isolation=none test/task-1200-ticket-number-scenario.test.js`.
- Lokální runner používající skutečné funkce vyhodnocení Klikátka:
  `C:/Users/op3782/source/repos/tmp/task-1200-cross-service/run-klikatko.cjs`.

Scénář je spojen s [GitLab #1200](https://gitlab.com/operator-ict/mobility/mos-pid/pid-litacka-aplikace/pid-litacka-2.0/pid-litacka-2.0-general/-/work_items/1200).
