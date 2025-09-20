# LegendIdle prototüüp

LegendIdle on RuneScape'ist inspireeritud brauserimängu varajane prototüüp. Esimene versioon keskendub avalehe ja kasutajahaldusvoogude loomisele: külalismäng, konto registreerimine, sisselogimine ja lihtne mänguseanss, kus saab oskusi tõsta.

## Põhivõimalused

- **Avaleht** info ja tegevustega (registreerimine, sisselogimine, külaline).
- **Külalisseanss**, mida saab hiljem kontoks muuta nii, et külalise progress säilib.
- **Registreerimine ja sisselogimine** koos paroolide turvalise räsi talletamisega.
- **Lihtne mänguvaade**, kus on nähtavad oskused ning võimalik neid treenida.
- **Seansi haldus** (sisaldab küpsise-põhist sessiooni ning väljalogimist).

## Kuidas käivitada

1. Veendu, et sinu süsteemis on olemas Node.js (versioon ≥ 18).
2. Käivita arendusserver:
   ```bash
   npm start
   ```
3. Ava brauseris aadress `http://localhost:3000`.

Kasutajaandmed salvestatakse faili `data/users.json`. Faili võib vajadusel kustutada, et alustada puhtalt lehelt.

## Kaustastruktuur

- `src/server.js` – lihtne HTTP-server ja rakenduse põhilogiika.
- `src/templates.js` – HTML-i genereerivad abifunktsioonid.
- `src/userStore.js` – abifunktsioonid kasutajaandmete lugemiseks ja kirjutamiseks.
- `public/styles.css` – avalehe ja mänguvaate stiilid.
- `data/users.json` – registreeritud kasutajate andmed.

## Järgmised sammud

- Combat-süsteemi põhialuste loomine (NPC-d, võitluse tulemused, tervis).
- Skillide laiendamine ressursside ja esemetega.
- Andmebaasi kasutuselevõtt (nt SQLite), et asendada failipõhine salvestus.
- Reaalajas sündmuste ja aktiivsuste logi (nt WebSocketid).
- UI täiendused ja responsiivsus väikeste ekraanide jaoks.

See prototüüp on mõeldud ideede valideerimiseks ja edasiste arenduste planeerimiseks.
