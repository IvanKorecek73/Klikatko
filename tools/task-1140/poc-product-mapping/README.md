# PoC mapování produktů IPT → Tickets

Účelem je ověřit převod pro aktivaci jízdenky z hledání (#1007), nikoli spravovat produktové katalogy.

PoC porovná snapshot IPT PROD se snapshotem Tickets INT a nad každou dvojicí vytvoří dva nezávislé verdikty:

- `ACTIVATE_EXISTING`: kompatibilita dříve koupeného `AVAILABLE` kusu. Cena, DPH a prodejní období mohou být odlišné.
- `PURCHASE_NEW`: shoda aktuálního produktu pro nový nákup. Cena, DPH a aktuální prodejní dostupnost jsou povinné.

## Spuštění

```powershell
node src/index.mjs
node --test
```

Výstupy vzniknou v `report/`:

- `report.html` — kontrolní přehled pro člověka;
- `report.json` — úplný strojově čitelný výsledek;
- `summary.md` — stručné počty a nejčastější rozdíly;
- `suggested-mapping.csv` — nejlepší automaticky nalezený kandidát pro každý IPT produkt. Je to pracovní návrh, nikoli schválené mapování.

Ručně potvrzované vazby patří do `mapping.csv`. Sloupec `usage` přijímá `ACTIVATE_EXISTING`, `PURCHASE_NEW` nebo `BOTH`. Sloupec `humanDecision` přijímá `UNDECIDED`, `APPROVED` nebo `REJECTED`; lidské zamítnutí přebije oba automatické verdikty na `MISMATCH`. Stejné IPT ID může mít více řádků pro starší aktivačně kompatibilní produkty; pro `PURCHASE_NEW` smí být po potvrzení pouze jeden aktuální cíl. Neúplné mapování nebrání spuštění PoC. Automatický kandidát se nikdy nepovažuje za autoritativní vazbu.

HTML porovná ručně zadané vazby. U dosud nenapárovaných produktů zobrazí stejné detailní porovnání nejlepšího automatického kandidáta označeného `SUGGESTED`, aby šel provést první průchod všech produktů bez předstírání, že jsou vazby schválené.

Výchozí vstupy jsou existující snapshoty v `../podklady/`. Lze je změnit:

```powershell
node src/index.mjs --ipt cesta\ipt.json --tickets cesta\tickets.json --mapping cesta\mapping.csv --out cesta\report
```

Pro kontrolní report nad všemi automatickými kandidáty:

```powershell
node src/index.mjs
node src/index.mjs --mapping report\suggested-mapping.csv --out candidate-report
```

## Význam výsledků

- `MATCH` — všechny povinné a dostupné hodnoty se shodují.
- `WARNING` — rozdíl je diagnosticky důležitý, ale nebrání danému použití. Patří sem DPH, vyloučená pásma, příznak zastropování a konkrétní prodejní data; cena je varování pro aktivaci a překážka pro nový nákup.
- `REVIEW` — rezervovaný stav pro budoucí ruční rozhodnutí; samotné chybějící pole jej nevytváří.
- `MISMATCH` — nejméně jedna povinná hodnota se liší.
- `UNMAPPED` — IPT produkt není v ruční převodní tabulce.

Rozdílný `name` je `INFO`: report jej ukazuje, ale neovlivňuje výsledný verdikt.

Zóny se posuzují asymetricky. Když jsou zóny IPT podmnožinou zón Tickets, jde o `WARNING`: Tickets připouští širší rozsah, ale požadavek IPT lze obsloužit. Pokud Tickets postrádá některou zónu požadovanou IPT nebo se množiny překrývají jinak, jde o `MISMATCH`.

Pole bez protějšku (`NO_COUNTERPART`) je varování a UC neblokuje. Neshodu lze založit pouze porovnáním dvou existujících srovnatelných hodnot.

Levý svislý okraj karty používá tři výsledkové barvy. Zelená znamená použitelné pro primární UC #1007 (`MATCH` nebo `WARNING`), červená automaticky nepoužitelné (`MISMATCH`, `REVIEW` nebo `UNMAPPED`) a tmavě oranžová lidsky zamítnutého kandidáta. Jednotlivé výsledky v detailní tabulce zachovávají obvyklou konvenci: `MATCH` zeleně, `WARNING` žlutě, `INFO` modře a `MISMATCH` červeně. Souhrnné štítky aktivace a nákupu jsou neutrální.

Každý parametr se v HTML zobrazuje v původní i normalizované podobě. `NO_COUNTERPART` je viditelné a nesmí se tiše považovat za shodu.

## Podklad pro databázový seed

Po týmovém rozhodnutí se produkčně nebude implementovat automatická synchronizace ani administrační API. PoC zůstává archivovaným nástrojem pro budoucí přegenerování mapování.

Původní minimální výstup [seed/ipt-ticket-mapping-v1.csv](seed/ipt-ticket-mapping-v1.csv) obsahuje 51 efektivně použitelných dvojic z reportu v6. Preferovaná [v2](seed/ipt-ticket-mapping-v2.csv) přidává povinný příznak `isPurchaseTarget`: #1007 používá všechny řádky, #1008 jen aktuální nákupní cíl. Původ a kontrolní součty jsou v [seed/README.md](seed/README.md) a [SHA256SUMS.txt](SHA256SUMS.txt).

Seed v2 je pracovní návrh čekající na kontrolu produktového specialisty a změny v Tickets BackOffice. Implementace schématu a resolveru na jeho finální podobě nesmí záviset; schéma a datové naplnění mají vzniknout ve dvou samostatných EF migracích.
