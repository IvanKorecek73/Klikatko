# #1162 – test vlastnictví kupónů v Klikátku

## Stav

**22. 9. 2026, INT:** účet z bugu funguje pod opravenou adresou `+p30`. Čtecí volání Klikátka na `https://pidl2-backend.int.pidlitacka.cz` vrátila HTTP 200: `/v1/client/identifiers` obsahuje 16 nosičů, `/v1/client/coupons` 15 nosičů a 6 kupónů (`Completed`). Nosič `2018695` je v loginovém seznamu a není ve vlastním přehledu; každý z 6 vrácených kupónů odkazuje na nosič přehledu. Přesné aserce připravené pro jinou sadu 4/2/1 se pro tento účet nedají vyhodnotit jako pass. Potvrzení CustomerId a existence kupónu propojeného zákazníka vyžaduje raw Core MOS nebo jinou ověřenou fixture. Klikátko při INT volání neporovnává session se svým lokálním Redis bridge, platnost ověřuje INT backend.

Scénář je připravený. Dne 22. 9. 2026 proběhl základní průchod v Klikátku proti lokálnímu BE z commitu `0196f87c7b6b76510e2f6109fc3f182ab2237f86` (`LOCAL ASPIRE`, MOS `PRE-CORE`): anonymní přihlášení uspělo a scénář #1162 správně odmítl pokračovat bez registrovaného uživatele s MOS session. Několik uložených demonstračních účtů a účet z issue #1162 skončily při přihlášení chybou „Nesprávné heslo nebo e-mail“. Vlastnické aserce nad reálnými daty proto **neproběhly**; podle domluvy se zadavatelem je ověříme na INT po nasazení. Používejte pouze vyhrazené testovací účty na MOS PRE/INT. Přihlašovací údaje, osobní data a celé PDF dokladů neukládejte do repozitáře ani do testovacího záznamu.

## Potřebná data

| Sada | MOS login a zákazníci | Nosiče | Platné kupóny |
| --- | --- | --- | --- |
| A – smíšený účet | Jeden Self, jeden Child a jeden Shared pod stejným loginem | Self personalizovaný, Self anonymní bez kupónu, Child, Shared; právě čtyři nosiče vrácené `GetTokens(false)` | Právě jeden viditelný `Valid` kupón Self na jeho personalizovaném nosiči; alespoň jeden `Valid` kupón Child a Shared na jejich nosičích |
| B – prázdný Self | Jeden Self bez nosiče a kupónu, jeden Child pod stejným loginem | Právě jeden nosič Child vrácený `GetTokens(false)` | Alespoň jeden `Valid` kupón Child, žádný Self |

U sady A zapište do formuláře čtyři skutečná `TokenID` a `CouponID` vlastního kupónu. U sady B zapište `TokenID` Child. Před spuštěním čtecím dotazem v Core MOS potvrďte `CustomerRelationType`, `CustomerIDx` u nosičů a `CustomerID`, `Status`, `TokenID` u kupónů. Ověřte, že kupóny Child a Shared jsou v loginové raw množině; veřejné PID DTO jejich vlastníka neuvádí. Syntetické hodnoty Self 42 / Child 43 / Shared 44 z analýzy nejsou testovací ID.

## Jak data připravit

1. Nejprve prověřte vyhrazený testovací účet uvedený v issue #1162 nebo existující MOS PRE účty. Použijte je jen tehdy, když lze vlastníky a přesné množiny potvrdit bez změny cizích dat.
2. Pokud vhodné účty nejsou, správce MOS PRE připraví dva vyhrazené loginy a vztahy Self, Child a Shared. Vazby zákazníků a vlastnictví nosičů se zakládají v Core MOS; veřejné PID API pro sestavení celé této fixture není k dispozici.
3. Založte testovací nosiče podle tabulky. Platné kupóny vytvořte schváleným testovacím postupem MOS PRE, případně použijte již existující. Nespouštějte placený nákup jen kvůli tomuto read-only testu bez předem domluveného testovacího platebního postupu.
4. Zaznamenejte ID a stav kupónů do neveřejného testovacího záznamu. Potvrďte, že `GetTokens(false)` nevrací další nosiče ani další vlastní `Valid` kupóny, které by změnily očekávané počty. Při změně dat nejprve obnovte baseline; neoslabujte aserce podle náhodného výsledku.

## Lokální spuštění před mergem

1. Ve Visual Studiu otevřete `C:/Users/op3782/source/repos/pid-litacka-2.0-backend-1162/PidLitacka.slnx` a spusťte projekt `PidLitacka.WebApi` s profilem `https`. Tento profil naslouchá na `https://localhost:7261`; Klikátko má na stejnou adresu nastavené výchozí prostředí **LOCAL**. Pokud BE běží jen na `http://localhost:5065`, zvolte v Klikátku prostředí **LOCAL ASPIRE**.
2. Lokální BE musí mít funkční PostgreSQL, Redis a konfiguraci `CoreMos:BaseUrl` a `CoreMos:ServiceKey` pro testovací MOS. V repozitářovém `appsettings.Development.json` endpoint a klíč MOS vyplněné nejsou; doplňují se bezpečně přes lokální user secrets nebo proměnné prostředí. Hodnoty nepatří do packu ani do commitu.
3. V Klikátku spusťte `Start-Klikatko-Local.cmd`, vyberte projekt **PidLitacka** a prostředí **LOCAL**. Přihlaste testovací MOS účet z datové sady A přes panel Uživatel a spusťte smíšený scénář. Poté se odhlaste, přihlaste účet B a spusťte prázdný Self scénář. Otevřený backend musí být právě z větve `fix/1162-own-coupons`, nikoli z původního checkoutu.

Lokální průchod ověří změnu **před mergem** proti skutečnému MOS PRE. Selže-li přihlášení nebo získání MOS session, nejprve ověřte konfiguraci a dostupnost MOS; prázdná response bez potvrzených raw dat není platný důkaz. Scénáře nemají omezení na INT a `smoke: false` jen brání jejich nechtěnému automatickému spuštění.

## Spuštění a důkaz

V Klikátku vyberte projekt PidLitacka, pack **#1162: vlastní kupóny a propojené účty** a prostředí LOCAL s opraveným BE/MOS PRE nebo INT po nasazení. Přihlaste sadu A, vyplňte ID a spusťte scénář „smíšený účet“. Potom se odhlaste, přihlaste sadu B a spusťte „vlastní účet bez položek“. Oba scénáře jsou read-only a mimo smoke.

Pass pro A: samostatný `/v1/client/identifiers` potvrdí čtyři nosiče loginu; `/v1/client/coupons` vrátí přesně oba vlastní nosiče (včetně anonymního) a jeden vlastní kupón na správném nosiči. Pass pro B: samostatný seznam potvrdí Child nosič a vlastní přehled vrátí prázdná `identifiers` a `coupons`. Starý BE na těchto datech musí selhat na počtech v přehledu.

Do výsledku uložte prostředí, BE commit/build, datum, anonymizovanou identifikaci fixture, potvrzenou raw množinu MOS a výsledek obou scénářů. Na FE pak zvlášť ověřte online refresh a offline cache; Klikátko testuje veřejné API, nikoli obrazovku aplikace. Živý průchod vlastnickými asercemi čeká na INT.
