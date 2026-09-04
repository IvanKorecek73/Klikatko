# Podklady pro první databázový seed

> **Stav: DRAFT — čeká na kontrolu produktového specialisty.** Současný obsah se nesmí považovat za schválený produkční seed. Po kontrole a očekávaných úpravách Tickets vznikne nová verzovaná varianta; tento soubor zůstane zachovaný jako podklad PoC.

Soubor `ipt-ticket-mapping-v1.csv` zachovává původní dvousloupcovou variantu.

Preferovaný soubor `ipt-ticket-mapping-v2.csv` obsahuje `iptProductId,ticketProductId,isPurchaseTarget`. Příznak je povinný a explicitní:

- #1007 používá všechny řádky pro vyhledání aktivačních fulfillmentů;
- #1008 používá pouze řádek s `isPurchaseTarget = true`;
- historická Tickets ProductId zůstávají v tabulce s `isPurchaseTarget = false`.

- Počet dvojic: 51
- Zdroj: candidate-report-v6/report.json
- Výběr: efektivně použitelné pro aktivaci i nákup; bez humanDecision = REJECTED
- Stav: podklad pro budoucí EF migraci, nikoli již aplikovaný databázový seed
- Zdrojový report SHA-256: 4D2757A62640944F735F6A441CA9B79C5560D24EA83D1FE0E6F8257D8EA8A4F5
- Vstupní mapování v6 SHA-256: 35B5AF2A9214BE5A3A57113304F393E35EB11326E058FFFC0BFEC965BD75453C
- Výstupní CSV SHA-256: 809BA6A2EE84A82F8F3022C41162EA381748B27240BD0E9D2D548E25D04DA8D7
- Výstupní CSV v2 SHA-256: 2BCACEDCE600F407925EA3FE8174202557CF79521A0B12B4EA1FB4FA61D1CF43

Tabulka musí připustit více Tickets ProductId pro jedno IPT ProductId a současně vynutit nejvýše jeden nákupní cíl pro každé IPT ID. V první sadě je všech 51 dvojic aktuálních, proto mají všechny `isPurchaseTarget = true`.
