# Souhrn PoC mapování IPT → Tickets

Vygenerováno: 2026-09-04T09:11:19.394Z

| Výsledek | Aktivace | Nový nákup |
|---|---:|---:|
| MATCH | 0 | 0 |
| REVIEW | 0 | 0 |
| MISMATCH | 1 | 1 |

- IPT produktů: 64
- Tickets produktů: 76
- IPT produktů s ruční nebo vstupní vazbou: 1
- Posouzených vazeb: 1
- Bez vazby: 63

## Nejčastější rozdíly

| Pole | Počet vazeb |
|---|---:|
| `isCapAble` | 1 |
| `vatRate` | 1 |
| `availableSince` | 1 |
| `availableUntil` | 1 |
| `name` | 1 |

## Chybějící protějšky

| Pole | Počet vazeb |
|---|---:|
| `zoneCount` | 1 |
| `cptp` | 1 |

## Automatické kandidáty se skóre pod 80 %

- IPT 814 (přepravné kolo celodenní - pouze vlak): Tickets 1076, skóre 69 %
- IPT 883 (Zastropování ceny jízdného Praha, dospělý): Tickets 1003, skóre 78 %
- IPT 889 (Zavazadlo): Tickets 1074, skóre 64 %
- IPT 890 (Skupinové  1 + 2 vnější pásma): Tickets 1061, skóre 36 %
- IPT 891 (Skupinové 2 + 4 vnější pásma): Tickets 1062, skóre 36 %
- IPT 901 (Zastropování ceny jízdného Praha, senior): Tickets 1019, skóre 78 %
- IPT 927 (Zvíře): Tickets 1074, skóre 58 %

## Nerozhodné nejlepší skóre

- IPT 884: shodné nejlepší skóre 100 % pro Tickets 1049 a 1051
- IPT 900: shodné nejlepší skóre 91 % pro Tickets 1072 a 1073

Automatické skóre slouží pouze k výběru kandidáta pro ruční kontrolu. Verdikty vznikají porovnáním jednotlivých polí.
