# Souhrn PoC mapování IPT → Tickets

Vygenerováno: 2026-09-07T09:57:03.767Z

| Výsledek | Aktivace | Nový nákup |
|---|---:|---:|
| MATCH | 0 | 0 |
| WARNING | 52 | 52 |
| REVIEW | 0 | 0 |
| MISMATCH | 10 | 10 |

- IPT produktů: 64
- Tickets produktů: 76
- IPT produktů s ruční nebo vstupní vazbou: 62
- Posouzených vazeb: 62
- Ručně schválených vazeb: 7
- Schválených vazeb čekajících na opravu dat: 6
- Produktů mimo rozsah #1007/#1008: 2
- Použitelných pro aktivaci: 52
- Použitelných pro nový nákup: 52
- Lidsky zamítnutých vazeb: 4
- Bez vazby: 0

## Produkty mimo rozsah #1007/#1008

- IPT 883 (Zastropování ceny jízdného Praha, dospělý): Capping produkt nahrazující předchozí jízdenku při denním zastropování ceny. Nebude nabízen ve vyhledávání, je mimo rozsah #1007/#1008 a nevstupuje do seedu.
- IPT 901 (Zastropování ceny jízdného Praha, senior): Capping produkt pro seniora. Nebude nabízen ve vyhledávání, je mimo rozsah #1007/#1008 a nevstupuje do seedu.

## Schválené vazby čekající na opravu dat

- IPT 886 → Tickets 1054: Ručně schválená vazba. Správná pásma jsou P,0,B,1,2,3,4; Tickets snapshot nyní postrádá P a B. Opravit produkt 1054 v Tickets před použitím seedu.
- IPT 889 → Tickets 1074: Ručně schválená vazba. Maximální platnost je 180 min; v Tickets změnit duration produktu 1074 z 1440 na 180 minut před použitím seedu.
- IPT 890 → Tickets 1061: Ručně schválená vazba. V Tickets narovnat zjištěné rozdíly produktu 1061: productSubTypeCode adult na group a duration 1680 na tarifní hodnotu 240 pro FROM_NEXT_MIDNIGHT.
- IPT 891 → Tickets 1062: Ručně schválená vazba. V Tickets narovnat zjištěné rozdíly produktu 1062: productSubTypeCode adult na group a duration 1680 na tarifní hodnotu 240 pro FROM_NEXT_MIDNIGHT.
- IPT 926 → Tickets 1002: Ručně schválená vazba. Jde o jeden flexibilní třípásmový produkt: varianta pro Prahu nebo tři navazující vnější pásma. Stávající model Tickets to umí jedním produktem; u 1002 nastavit povolená pásma P,0,B,1–13 a ZoneCount=3. Dva produkty nejsou pro současný model nutné.
- IPT 927 → Tickets 1074: Ručně schválená vazba na stejný společný produkt jako zavazadlo. Platnost je dynamická, maximálně 180 min; v Tickets změnit duration produktu 1074 z 1440 na 180 minut před použitím seedu.

## Nejčastější rozdíly

| Pole | Počet vazeb |
|---|---:|
| `vatRate` | 62 |
| `availableSince` | 62 |
| `availableUntil` | 62 |
| `name` | 62 |
| `excludedZones` | 38 |
| `zones` | 32 |
| `duration` | 5 |
| `isCapAble` | 4 |
| `price` | 4 |
| `passengerType` | 2 |

## Chybějící protějšky

| Pole | Počet vazeb |
|---|---:|
| `cptp` | 62 |
| `zoneCount` | 22 |

## Automatické kandidáty se skóre pod 80 %

- IPT 814 (přepravné kolo celodenní - pouze vlak): Tickets 1076, skóre 74 %
- IPT 883 (Zastropování ceny jízdného Praha, dospělý): Tickets 1003, skóre 76 %
- IPT 889 (Zavazadlo): Tickets 1074, skóre 62 %
- IPT 890 (Skupinové  1 + 2 vnější pásma): Tickets 1061, skóre 38 %
- IPT 891 (Skupinové 2 + 4 vnější pásma): Tickets 1062, skóre 38 %
- IPT 901 (Zastropování ceny jízdného Praha, senior): Tickets 1019, skóre 76 %
- IPT 927 (Zvíře): Tickets 1074, skóre 62 %

## Nerozhodné nejlepší skóre

- IPT 884: shodné nejlepší skóre 100 % pro Tickets 1049 a 1051
- IPT 900: shodné nejlepší skóre 90 % pro Tickets 1072 a 1073

Automatické skóre slouží pouze k výběru kandidáta pro ruční kontrolu. DPH, vyloučená pásma, zastropování a prodejní data jsou varování; název je informace. Pokud jsou zóny IPT podmnožinou zón Tickets, jde o varování; opačný vztah nebo jiný překryv blokuje použití. `APPROVED` potvrzuje identitu vazby, ale neskryje neopravená data; jen pole v `ignoredFields` jsou ruční výjimkou snížena na varování. `EXCLUDED` je mimo rozsah obou UC a seedu.
