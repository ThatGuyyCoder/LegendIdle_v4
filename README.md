# LegendIdle prototüüp

LegendIdle on RuneScape'ist inspireeritud brauserimängu varajane prototüüp. Käesolev versioon keskendub avalehe ja kasutajahaldusvoogude loomisele: külalismäng, konto registreerimine, sisselogimine ning lihtne mänguseanss, kus saab oskusi treenida. Andmete talletamiseks kasutatakse nüüd MySQL-andmebaasi, mis sobib hästi XAMPP-keskkonnaga.

## Põhivõimalused

- **Avaleht** info ja tegevustega (registreerimine, sisselogimine, külaline).
- **Külalisseanss**, mida saab hiljem kontoks muuta nii, et külalise progress säilib.
- **Registreerimine ja sisselogimine** koos e-posti välja, topeltparooli kontrolli ning parooli tugevuse indikaatoriga.
- **Lihtne mänguvaade**, kus on nähtavad oskused ning võimalik neid treenida.
- **Seansi haldus** (küpsise-põhine sessioon ning väljalogimine).
- **MySQL-andmebaas** kasutajate, oskustaseme ja progressi salvestamiseks.

## Eeltingimused

- Node.js 18 või uuem
- MySQL server (nt XAMPP-i kaudu)

## Andmebaasi seadistamine (MySQL/XAMPP)

1. Käivita MySQL server. XAMPP-i puhul piisab MySQL teenuse käivitamisest XAMPP Control Panelist.
2. Vaikimisi püüab rakendus luua andmebaasi nimega `legendidle`. Kui kasutad teist nime või vajad parooli, sea järgmised keskkonnamuutujad enne serveri käivitamist:
   - `DB_HOST` (vaikimisi `localhost`)
   - `DB_PORT` (vaikimisi `3306`)
   - `DB_USER` (vaikimisi `root`)
   - `DB_PASSWORD` (vaikimisi tühi)
   - `DB_NAME` (vaikimisi `legendidle`)
3. Esmakäivitusel luuakse automaatselt vajalik andmebaas ja tabelid:
   - `users` (kasutaja põhiinfo, e-post, räsi, kuld, viimane treeningaeg)
   - `user_skills` (kasutaja oskuste tasemed)

Kui automaatne loomine ei ole lubatud, saad tabelid käsitsi luua järgmise SQL-iga:
```sql
CREATE DATABASE IF NOT EXISTS legendidle CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE legendidle;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  normalized VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  gold INT NOT NULL DEFAULT 0,
  last_training DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE user_skills (
  user_id INT NOT NULL,
  skill_name VARCHAR(50) NOT NULL,
  level INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, skill_name),
  CONSTRAINT fk_user_skills_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Kuidas käivitada

1. Paigalda sõltuvused:
   ```bash
   npm install
   ```
2. Käivita server (vajadusel lisa keskkonnamuutujad samale reale):
   ```bash
   npm start
   # või näiteks
   # DB_USER=root DB_PASSWORD=salasõna npm start
   ```
3. Ava brauseris aadress `http://localhost:3000`.

## Kaustastruktuur

- `src/server.js` – HTTP-server ja rakenduse põhiloogika.
- `src/templates.js` – HTML-mallid ja UI-dünaamika.
- `src/userStore.js` – kasutajaandmete lugemine ning salvestamine MySQL-andmebaasi.
- `src/db.js` – MySQL ühenduse ja skeemi initsialiseerimine.
- `src/progress.js` – abifunktsioonid vaikeprogressi haldamiseks.
- `public/styles.css` – avalehe ja mänguvaate stiilid.
- `package.json` – projektis kasutatavad sõltuvused ja skriptid.

## Järgmised sammud

- Combat-süsteemi põhialuste loomine (NPC-d, võitluse tulemused, tervis).
- Skillide laiendamine ressursside ja esemetega.
- Parooli taastamise ja e-posti kinnituse lisamine.
- Reaalajas sündmuste ja aktiivsuste logi (nt WebSocketid).
- UI täiendused ja responsiivsus väikeste ekraanide jaoks.

See prototüüp on mõeldud ideede valideerimiseks ja edasiste arenduste planeerimiseks.
