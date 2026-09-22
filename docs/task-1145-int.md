# #1145 — ověření validace pásem na INT

Připraveno 16. 9. 2026 po uživatelem potvrzeném schválení MR, merge a nasazení na INT.
**BE implementace je dokončená a nasazená na INT; podle navazujícího potvrzení
uživatele se další BE práce nepředpokládá.** Zbývající kroky jsou dokončení
testovacího ověření po dodání dat a doložení APK buildu.
**Stav po proklikání 16. 9.: 7/8 API scénářů PASS; 16 pásem BLOCKED kvůli chybějícímu kusu. FE BLOCKED na vstupní kontrole.**
Podrobný [protokol skutečného INT běhu](../../outputs/task-1145/int-run-20260916/report.md)
rozlišuje 52 úspěšných kroků dokončených scénářů a další dva přípravné kroky
nedokončeného scénáře. Pět aktivačních kroků pro 16 pásem nebylo spuštěno.
Veřejný katalog INT byl skutečně načten a zkontrolován. Lokální testy Klikátka
ověřují testovací scénáře a jejich aserce, nenahrazují průchod nasazenou aplikací.

## Spuštění v Klikátku

1. Spusťte `Start-Klikatko.cmd`, případně obnovte již otevřené Klikátko.
2. Projekt **PidLitacka**, prostředí **INTEGRAČNÍ**, pack
   **PidLitacka – #1145: validace pásem na INT**.
3. Proveďte **INT: zkontrolovat katalog (pouze čtení)**. Přihlášení není potřeba.
4. Přihlaste vyhrazený INT účet. Spusťte **INT: nabídka a rezervace Praha + pásmo 1**.
   Vznikne jedna nezaplacená rezervace; tento scénář neplatí a nevydává testovací kusy.
5. Spouštějte jednotlivé aktivační scénáře od začátku. Vyberte jízdenku tlačítkem
   v seznamu; ID se neopisuje. Po chybě nepokračujte. Všechny scénáře jsou mimo smoke.
6. V části **Workflow** vyberte prostředí **BE INTEGRACE + MOS PRE** a
   **INT – #1145: Praha a výběr pásem v aplikaci**. Projděte 11 kontrolních bodů.
   Jde o vedený ruční test; jedinou připravenou akcí emulátoru je restart INT aplikace.
   Proklikání bodů samo nepotvrzuje správnost UI ani response.

Pack kontroluje zvolené prostředí i skutečný cíl proxy před každým krokem, včetně
samostatného spuštění z Formulářů. LOCAL zůstává výchozí. Správný backend je
`https://pidl2-backend.int.pidlitacka.cz/`; APK musí být INT s opravou #1145,
balíček `cz.dpp.praguepublictransport.pidlitacka.int`. Pro emulátor používejte
existující `Start-Emulator.ps1`; žádné lokální fixture ani seedy se nespouštějí.

## Testovací data

Katalog načtený 16. 9. 2026: produkt **1004, 60 min, 48 Kč, zoneCount=4** povoluje
`P,0,B,1` a nemá vyloučená pásma. Totéž bez omezení platí pro sedmipásmový 1007
a šestnáctipásmový 1016. Pevná Praha 1002 má `P,0,B`, bez `zoneCount`.
Pack znovu kontroluje produkt, publikovaný stav, rozsah a vyloučená pásma při běhu;
změna katalogu vyžaduje posouzení, nikoli odmazání neúspěšné aserce.

Pro kompletní API sadu připravte **6 AVAILABLE kusů**: 3× 1004, 1× 1007,
1× 1016, 1× 1002. Pro kompletní FE sadu dalších šest kusů ve stejném složení.
API aktivace sváže kus se zařízením Klikátka, proto jej nelze znovu použít pro
aktivaci v emulátoru. Použijte existující testovací zásobník nebo samostatně
připravte nákup v INT sandboxu s `activateAfterPayment=false`.

Flexibilní kusy musejí mít `validZones` prázdné, `null` nebo vynechané.
Pokud jsou pásma již předvolená v nákupu, aktivace jde jinou větví validace a
neprokáže opravu #1145. Test to kontroluje přes detail před první aktivací.
Samotné `activateAfterPayment=false` chybějící předvolbu nezaručuje — ověřte
vydaný kus; pro přípravu nevyplňujte zóny ani čas aktivace v nabídce.
Seznam umožňuje výběr z prvních 100 AVAILABLE kusů; při absenci vhodného kusu
použijte připravený účet s menším zásobníkem. Chybějící data jsou **BLOCKED**, ne PASS.

## Pokrytí a očekávání

| Případ | Produkt | Očekávaná pásma / výsledek |
|---|---:|---|
| Hlavní reprodukce | 1004 | `P,0,B,1`, 4 štítky, aktivace 200 |
| Krátký / dlouhý výběr | 1004 | `P,0,B` / `P,0,B,1,2` → 422 |
| Mezera / duplicita / neznámé / chybějící | 1004 | `P,B,1,2` / `P,P,0,B` / `P,0,B,X` / null → 422 |
| Bez P | 1004 | `0,B,1,2` → 200 |
| Numerická hranice | 1004 | `9,10,11,12` → 200; FE nesmí dovolit pouze `10,11,12,13` |
| Praha + 1–4 | 1007 | `P,0,B,1,2,3,4` → 200 |
| Celý rozsah | 1016 | `P,0,B,1,…,13`, 16 štítků → 200 |
| Pevná Praha | 1002 | Aktivace bez volby, ETD `P,0,B`; `zoneCount` může chybět |
| Nabídka a rezervace | 1004 | Krátký seznam 422; správný seznam zachován v `admission.zones` i `bookedOffers[0].validZones` |

Po **každém** odmítnutí se načítá stejný kus a musí zůstat AVAILABLE bez předvolby.
Potom tentýž kus přijme platnou aktivaci. U každé úspěšné varianty se kontrolují
identita kusu, počet pásem, stav FULFILLED/IN_PROTECTION_DELAY, časy a přesný `VZ`
v ETD. Opakování používá **stejný idempotency key i tělo** a musí vrátit shodné celé
ETD. Následný GET detailu ověřuje stejný kus a shodné ETD bez závislosti na stránkování.
PID BE vrací detail v obálce `fulfillment`; aserce GET proto používají
`$.fulfillment.*`, zatímco PATCH vrací plochý objekt. Pro načtení ETD posílá
readback `X-Device-Id` s registrovaným Tickets `deviceId` z odpovědi registrace,
stejným jako v aktivačním requestu. Instalační identifikátor není jeho náhradou.
Celý scénář znovu spouštějte až s novým AVAILABLE kusem; neopakujte úspěšnou aktivaci
s novým klíčem.

FE průchod navíc ověřuje možnost volby Praha + 1, přepínání bloků, skutečně odeslaný
seznam, aktivaci a zobrazení po obnovení detailu. Zákaz čistě vnějšího bloku 10–13
je součástí FE opravy (`30d7ee4f`), proto jej test neočekává jako kladný příklad.

## Záznam výsledku

Pro každý běh uložte redigovaný export logu a snímky obrazovek. Nezveřejňujte
Authorization, refresh token, heslo ani celé podepsané ETD. Pro sdílený protokol
postačuje výsledek porovnání ETD a hodnota `VZ`; surové důkazy držte v určeném
testovacím úložišti. Uveďte čas včetně časové zóny.

| Údaj | Hodnota |
|---|---|
| Datum / tester | doplnit |
| Revize Tickets / PID BE / FE, APK build | doplnit; neznámé označit neověřeno |
| Revize Klikátka / změny pracovního stromu | doplnit |
| Prostředí / skutečný backend / testovací účet | doplnit |
| Katalog | PASS / FAIL, produktová metadata a čas |
| Nabídka / rezervace | PASS / FAIL / NOT RUN, bookingId |
| Každá API varianta | PASS / FAIL / BLOCKED / NOT RUN, fulfillmentId, HTTP, VZ, shoda retry/readback |
| FE hlavní případ / obnovení detailu | samostatné výsledky, fulfillmentId a snímky |
| FE ostatní varianty / zákaz 10–13 | samostatné výsledky a důkazy |
| Odchylky / blokace | doplnit |

Souhrnný PASS vyžaduje skutečně provedené API i FE případy. Přeskočené varianty
nebo chybějící testovací kusy nesmějí být zelené.

Tato sada neprokazuje platbu, produkční chování, nezávislou kryptografickou validaci
HSM podpisu ani opravu samostatného problému `ValidZones`/reaktivace
`NEO-TS-960-ACTIVATION-ZONES`. Případný chybný FE detail evidujte samostatně;
úspěšné ETD samo není důkaz správného zobrazení aplikace.

## Lokální kontrola testu

```powershell
node --test test/task-1145-int-scenario.test.js
```

Test používá skutečné vyhodnocování asercí Klikátka a pozitivní i negativní
kontroly: starý počet pásem, nesprávný kus, předvolené zóny, nezachované ETD
a chybné prostředí. Žádné INT změny tento příkaz neprovádí.
