# #1147 — aktivní pásma přes API PID Lítačky

Pack **PidLitacka – #1147: aktivní pásma přes API** ověřuje data, která dostane FE z PID Lítačky 2.0. Pro tuto BE opravu uživatel 17. 9. 2026 určil jako dostačující API test bez FE emulátoru. Test neověřuje vykreslení textu „Pásma 2–5“, sekund ani číselného kódu ve Flutter aplikaci.

## Co musí projít

- Aktivace čtyřpásmové jízdenky bez předem vybraných pásem vrátí přesně `validZones: ["2","3","4","5"]` a shodné `VZ:2,3,4,5` v ETD.
- Opakování se stejným `Idempotency-Key` zachová celé ETD i pásma.
- Nový GET detailu kontroluje `$.fulfillment.validZones`, nový GET seznamu kontroluje `$.items` a váže pásma i ETD na **stejné fulfillmentId**. Pásma u jiné jízdenky nesmějí test splnit.
- Neplatný třípásmový výběr vrátí 422; čerstvý detail zůstane AVAILABLE bez pásem. Následná platná aktivace znovu použije klíč odmítnutého požadavku.
- Plánovaná aktivace a reaktivace zachovají původní pásma 2–5, i když nový request obsahuje 3–6.
- Pevná pražská jízdenka zachová `P,0,B`.

Prázdné pole, `null` i vynechané `validZones` musí být po aktivaci chyba, i pokud samotné ETD obsahuje správné VZ. To odlišuje tuto regresi od původního packu #960, který kontroloval pouze předání pásem do ETD. Původní výjimka v #960 není potvrzením opravy #1147; pro ni je určující tento nový pack.

## Lokální spuštění

1. Spustit PID BE na `http://localhost:5065` s upstreamem Tickets `http://localhost:18080`. V izolovaném `tickets-smoke-960` musí API běžet s opravou #1147. Fixture vyžaduje PostgreSQL `localhost:55432/ticket_service_dev`, Docker a .NET 10. Validovaný detail také vyžaduje dostupné HSM RVI klíče; lokální konfigurace používá `http://127.0.0.1:8888/rvi`.
2. V Klikátku vybrat **PidLitacka → LOCAL ASPIRE**, přihlásit testovací identitu (stačí anonymní session).
3. Vybrat nový pack a ve Smoke spustit tři lokální scénáře: okamžitá aktivace, plánovaná aktivace/reaktivace, pevná Praha. Očekává se **3 scénáře / 28 kroků** bez chyb či varování.
4. Scénář plánované aktivace dokončit do pěti minut od vytvoření fixture. Lokální ochranná prodleva musí být kratší než zbývající čas do plánovaného začátku (ověřené lokální nastavení má 60 sekund).

Fixture nahrazuje nákup a platbu, vytvoří nový AVAILABLE fulfillment pro testovací identitu; nemockuje aktivační ani čtecí odpovědi. Produkty `1145104` a `960001` jsou syntetické. Aktivace, retry i GETy jdou přes veřejné `/v1/client/tickets` v PID BE. Detail používá `X-Device-Id` získané registrací zařízení v Tickets, aby BE neskryl ETD.

Scénáře jsou pevně svázané s prostředím i skutečným proxy cílem. Nespouštět s ručně změněnými poli: upravený scénář může chyby zobrazovat jako varování, což není PASS této regrese. Seznam se kontroluje v první stránce 100 položek; čerstvá lokální identita zabraňuje záměně s velkým starším zásobníkem.

## Ověření po nasazení na INT

Samostatný scénář **INT — aktivní pásma 2–5 přes PID BE** je ruční a mimo automatický smoke. Vyžaduje INTEGRAČNÍ prostředí s přesným cílem `https://pidl2-backend.int.pidlitacka.cz/` a vlastní testovací AVAILABLE produkt `1004`, `zoneCount: 4`, bez předvolených pásem. Výběr probíhá ze seznamu; před aktivací detail znovu ověří ID, produkt, počet, stav a absenci pásem.

Tento scénář jízdenku aktivuje a spotřebuje, ale nic nekupuje a neplatí. Bez vhodného kusu nebo bez nasazené opravy je výsledek NOT RUN/BLOCKED, nikoli PASS. Očekává se 9 kroků; předvybraná jízdenka není pro reprodukci původního bugu vhodná. Lokální úspěch nenahrazuje ověření nasazené INT revize.

## Automatická kontrola samotného packu

```powershell
node --test --test-isolation=none test/task-1147-active-zones-api.test.js
```

Testy používají skutečný `evaluateStep` z engine Klikátka. Pozitivní kontrolu doplňují odpovědi se správným ETD, ale chybějícími/prázdnými/chybnými pásmy, jiným ID, špatným ETD či chybným obalem detailu. Samotná zelená kontrola JSONu není živý API průchod.

## Výsledek běhu

**18. 9. 2026, INT: PASS 9/9 kroků přímo v UI Klikátka**, odpovědi 13:34:55–13:36:56 CEST. Ruční scénář `pidlitacka-1147-int-now` šel přes `https://pidl2-backend.int.pidlitacka.cz/v1/client/tickets`; všechny kroky v režimu `scenario`, bez úpravy asercí a bez varování. Profil Presentation Android 5506, existující AVAILABLE kus `69516c95-779a-4337-9097-e4cd692ba78b`, produkt 1004, `zoneCount: 4`, původně `validZones: []`.

Neúplná volba 2,3,4 vrátila 422 a detail zůstal AVAILABLE bez pásem. Následná aktivace 2,3,4,5 se stejným klíčem vrátila 200 a `validZones: ["2","3","4","5"]`; retry, GET detailu a seznam stejného kusu zachovaly pásma i celé ETD. GET detailu vrátil 13 RVI klíčů. Spotřebován jeden testovací kus, bez nákupu či platby; žádná lokální fixture nebo HSM/RVI náhrada nebyla pro INT vložena.

GitLab UI: MR !43 Merged do development jako `59e978495320296360f8edc944a13de78a8468ec`; pipeline `2861250977` Passed včetně test/release. Přesný image běžících podů a úplnost rolloutu všech workerů nebyly ověřeny. Funkční opravu prokazuje skutečné INT API, samotná pipeline není důkazem nasazení. Protokol: `C:/Users/op3782/source/repos/outputs/task-1147/int-ui-2026-09-18.json` (9 kroků a výřezy response, bez tokenů, plného ETD a RVI klíčů).

Tento INT běh neověřuje plánovanou reaktivaci, pevnou Prahu, vydání cappingové kompenzace ani FE emulátor; první dvě mají předchozí lokální důkazy, capping samostatné sady 46/46 a 22/22 PostgreSQL. Následující záznamy z 17. 9. jsou historické, jejich absence merge/INT testu je tímto výsledkem překonaná.

**Aktualizace po review, 17. 9. 2026 v 17:38 CEST:** guard ověřen unit sadou **1109/1109**, PostgreSQL HTTP **19/19** a opakováním tohoto packu **28/28**. Nová PG regrese ověřuje fixed-zone s katalogovým Zones, ZoneCount=null a bez předvolených pásem (null i []); původní klikací fixed scénář má předvolené P,0,B. Nová image Tickets: sha256:3982057f267dcb2d777231adbe0b689374957233aeb016688583da7be4e44081. Oddělené Klikátko: http://127.0.0.1:5100, PID BE stále 5065. Aktuální evidence: outputs/task-1147/klikatko-api-report.json a review-verification.md. HSM nadále testovací, INT neověřeno. Následující odstavce uchovávají první běh; jeho report je nyní klikatko-api-before-review.json.

**17. 9. 2026, 17:16 CEST: PASS — 3 scénáře / 28 kroků.** Spuštěny stejné JSON scénáře přes HTTP proxy Klikátka na portu 5099 a skutečný PID BE → Tickets → PostgreSQL. Automatický runner použil původní `evaluateStep`, resolvery, extrakce a context z engine Klikátka; nejde o ručně odklikanou UI relaci. V prohlížeči je pack dostupný pod stejným názvem.

| Scénář | Výsledek |
|---|---|
| Okamžitá aktivace 2–5, neplatný výběr, retry, detail a seznam | 9/9 |
| Plánovaná aktivace 2–5, retry, detail/seznam a reaktivace | 12/12 |
| Pevná Praha P,0,B, retry, detail a seznam | 7/7 |

Samostatný read-only SQL dotaz potvrdil uložená pole `{2,3,4,5}`, `{2,3,4,5}`, `{P,0,B}` u týchž tří jízdenek. Runner navíc ověřil, že reaktivace posunula začátek platnosti dříve a změnila podepsané ETD. Pack samotný kontroluje zachování pásem při reaktivaci; časový posun je doplňkový důkaz runneru. Všech 130 automatických testů Klikátka prošlo, z toho 9 nových kontrol tohoto packu. Skutečná PostgreSQL HTTP sada v Tickets: **17/17 PASS**.

Ověřené revize:

- Tickets `247de94b1ee532228cb61d69c14cb1715c713572` + necommitnutá oprava na `fix/1147-persist-activation-zones`; image `sha256:1c2154c8181a1d9e6c2db9df42daba103caf1d73320575a1e3ec90542a04d43d`.
- PID BE `ea5c873e94bb5a8bf126903e8731eb6d1d735c30`, existující lokální profil `https-tickets-smoke`; zdrojový kód kvůli testu beze změny.
- Klikátko `3f39244b23e036bf581d29e64977c790455da418` + existující pracovní změny a nový pack; pack SHA-256 `b02df13fa4c9e3a9c73b43ae51be3a9d22f6bd1f702b0bf1b49324e99e4467ac`.

Lokální evidence je v `C:/Users/op3782/source/repos/outputs/task-1147/`: `klikatko-api-report.json`, `run-api-pack.cjs`, `klikatko-tests.log`, `tests/task-1147-postgres-final.trx`, `verification.md`. Report neukládá přístupový token ani celé ETD. Předchozí neúspěšné pokusy jsou zachovány samostatně; detail původně vracel 502 kvůli neběžící lokální RVI službě, nikoli chybě pásem.

HSM podpis v Tickets i RVI časové klíče byly **testovací náhrady**. Pro RVI běžel pouze loopback stub `outputs/task-1147/rvi-test-stub.cjs`; PID BE měl procesní `ReferenceKeys__RedisKeyPrefix=task-1147-test-rvi:`, TTL 1 den a vypnutý updater, takže syntetické klíče neznečistily běžnou cache. Pro lokální start byly vygenerovány také dočasné klíče validátorů account/recovery odkazů; tyto flow se netestovaly. Žádná produkční konfigurace ani secret nebyly měněny. Ověřen je kontrakt a persistence pásem, nikoli kryptografie či odbavení jízdenky.

INT scénář nebyl spuštěn; po nasazení zbývá ruční průchod proti jeho skutečné revizi. Emulátor se podle uživatelova rozhodnutí pro tuto BE regresi nevyžaduje. Commit, push a MR zatím neproběhly.
