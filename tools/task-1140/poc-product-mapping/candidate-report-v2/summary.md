# Souhrn PoC mapování IPT → Tickets

Vygenerováno: 2026-09-04T10:43:05.294Z

| Výsledek | Aktivace | Nový nákup |
|---|---:|---:|
| MATCH | 0 | 0 |
| WARNING | 0 | 0 |
| REVIEW | 23 | 19 |
| MISMATCH | 41 | 45 |

- IPT produktů: 64
- Tickets produktů: 76
- IPT produktů s ruční nebo vstupní vazbou: 64
- Posouzených vazeb: 64
- Bez vazby: 0

## Nejčastější rozdíly

| Pole | Počet vazeb |
|---|---:|
| `vatRate` | 64 |
| `availableSince` | 64 |
| `availableUntil` | 64 |
| `name` | 64 |
| `excludedZones` | 38 |
| `zones` | 32 |
| `price` | 6 |
| `duration` | 5 |
| `isCapAble` | 4 |
| `durationType` | 2 |
| `pricingType` | 2 |
| `passengerType` | 2 |

## Chybějící protějšky

| Pole | Počet vazeb |
|---|---:|
| `cptp` | 64 |
| `zoneCount` | 24 |

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

Automatické skóre slouží pouze k výběru kandidáta pro ruční kontrolu. DPH, vyloučená pásma a prodejní data jsou varování; název je informace.
