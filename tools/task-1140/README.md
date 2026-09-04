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
  --mapping mapping-review-v6.csv `
  --out candidate-report-regenerated
```

Nový výstup používejte v novém adresáři. Zachované adresáře
`candidate-report-v1-original` až `candidate-report-v6` se nepřepisují.

## Stav dat

Soubor `seed/ipt-ticket-mapping-v2.csv` obsahuje 51 pracovních vazeb se sloupcem
`isPurchaseTarget`. Jde o návrh vzniklý z PoC, který čeká na finální kontrolu
produktového specialisty a případné úpravy produktů v Tickets BackOffice.

Produkční implementace automatickou synchronizaci nepřebírá. PoC slouží jako
archivovaný nástroj pro kontrolu a případné budoucí přegenerování seedu.
