# Task 1140 — PoC mapování produktů IPT → Tickets

Tento adresář archivuje spustitelný PoC vytvořený pro odstranění blockeru UC #1007
„Aktivace jízdenky z hledání“. PoC porovnává snapshot produktů IPT PROD se snapshotem
produktů Tickets INT, vytváří návrhy vazeb a odděleně hodnotí použitelnost již koupené
jízdenky a aktuální produkt pro nový nákup.

## Obsah

- [`poc-product-mapping/`](poc-product-mapping/) — zdrojový kód, testy, ruční mapování,
  všechny zachované verze reportů a návrh databázového seedu;
- [`podklady/ipt-mds-prod-products.json`](podklady/ipt-mds-prod-products.json) — vstupní
  snapshot IPT PROD;
- [`podklady/tickets-int-products.json`](podklady/tickets-int-products.json) — vstupní
  snapshot Tickets INT.

PoC je záměrně uložen spolu se vstupy, aby šel později zopakovat i bez dostupnosti
původních API. Podrobná pravidla jsou v
[`poc-product-mapping/README.md`](poc-product-mapping/README.md).

## Spuštění

Z adresáře `poc-product-mapping`:

```powershell
node --test

node src/index.mjs `
  --mapping mapping-review-v7.csv `
  --out candidate-report-regenerated
```

Nový výstup používejte v novém adresáři. Zachované adresáře
`candidate-report-v1-original` až `candidate-report-v7` se nepřepisují.

## Stav dat

Report v7 zapracovává ruční revizi devíti IPT produktů. Capping produkty 883 a
901 jsou výslovně mimo rozsah #1007/#1008. Sedm vazeb bylo ručně schváleno
a v reportu jsou proto zelené, použitelné a zařazené do mapování. U šesti z nich
detail nadále ukazuje rozdíly, které se musí opravit v Tickets.
`candidate-report-v7/seed-candidate.csv` obsahuje 58 rozhodnutých vazeb. Jde o
podklad pro budoucí seed; před nasazením je nutné opravit data a report zopakovat.

Původní `seed/ipt-ticket-mapping-v2.csv` s 51 vazbami zůstává zachován jako
historický podklad verze 6.

Produkční implementace automatickou synchronizaci nepřebírá. PoC slouží jako
archivovaný nástroj pro kontrolu a případné budoucí přegenerování seedu.

## Navazující regresní scénář

[`../../public/scenarios/pidlitacka/task-1140-ipt-ticket-mapping.json`](../../public/scenarios/pidlitacka/task-1140-ipt-ticket-mapping.json)
ověřuje přes lokální BE a Tickets tok `IPT 867 → Tickets 1002 → aktivace`.
Používá verzovanou fixture z [`../task-960-fixture/`](../task-960-fixture/).
Scénář začíná známým IPT `typeId`; neověřuje vznik `ptTicket` v odpovědi IPT ani
samostatný problém `userFareInfo`/CP 31.
