function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderFlash(flash) {
  if (!flash) {
    return '';
  }
  const typeClass = flash.type === 'error' ? 'flash-error' : 'flash-success';
  return `<div class="flash ${typeClass}">${escapeHtml(flash.message)}</div>`;
}

function layout({ title, body, user, flash }) {
  const navLinks = user
    ? `<div class="nav-user">Tere, ${escapeHtml(user.username)}${
        user.isGuest ? ' (külaline)' : ''
      }! <form method="POST" action="/logout" class="inline-form"><button type="submit">Logi välja</button></form></div>`
    : '<div class="nav-user"><a href="/">Avaleht</a></div>';

  return `<!DOCTYPE html>
<html lang="et">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="brand">
      <h1>LegendIdle</h1>
      <p>RuneScape'i stiilis brauserimängu prototüüp</p>
    </div>
    ${navLinks}
  </header>
  <main class="content-area">
    ${renderFlash(flash)}
    ${body}
  </main>
  <footer class="site-footer">
    <p>&copy; ${new Date().getFullYear()} LegendIdle meeskond. See on varajane prototüüp, mis on loodud ideede testimiseks.</p>
  </footer>
</body>
</html>`;
}

function renderHome({ user, flash }) {
  const hero = `<section class="hero">
    <h2>Seikle LegendIdle maailmas</h2>
    <p>LegendIdle on inspiratsiooni saanud RuneScape'ist, tuues brauserisse oskuste treenimise, rahuliku kogemuse ja koha, kus iga seiklus algab ühe klikiga.</p>
    <p>Alustame avalehest. Siin saad valida, kas soovid luua konto, sisselogida või hüpata kohe mängu külalise rollis.</p>
  </section>`;

  if (user) {
    const body = `${hero}
    <section class="card">
      <h3>Oled juba mängus!</h3>
      <p>Su seanss on aktiivne${user.isGuest ? ' külalisena' : ''}. Jätkamiseks suundu mängu vaatesse.</p>
      <a class="button primary" href="/game">Ava mäng</a>
    </section>`;
    return layout({ title: 'LegendIdle - Avaleht', body, user, flash });
  }

  const authForms = `<section class="forms-grid">
    <div class="card">
      <h3>Loo uus konto</h3>
      <form method="POST" action="/register">
        <label for="register-username">Kasutajanimi</label>
        <input id="register-username" name="username" required maxlength="32" />
        <label for="register-password">Parool</label>
        <input id="register-password" name="password" type="password" required minlength="6" />
        <button type="submit" class="button primary">Registreeru</button>
      </form>
      <p class="help-text">Kontoga jääb sinu progress alles ning saad mängu jätkata ükskõik kust.</p>
    </div>
    <div class="card">
      <h3>Logi sisse</h3>
      <form method="POST" action="/login">
        <label for="login-username">Kasutajanimi</label>
        <input id="login-username" name="username" required />
        <label for="login-password">Parool</label>
        <input id="login-password" name="password" type="password" required />
        <button type="submit" class="button">Logi sisse</button>
      </form>
      <p class="help-text">Sinu oskuste tase, varustus ja seiklused taastuvad koheselt sisselogimisel.</p>
    </div>
    <div class="card">
      <h3>Mängi külalisena</h3>
      <form method="POST" action="/guest">
        <button type="submit" class="button secondary">Alusta külalisena</button>
      </form>
      <p class="help-text">Testi mängu ilma kontota. Soovi korral saad hiljem mängus olles konto luua ning progress ei kao kuhugi.</p>
    </div>
  </section>`;

  const body = `${hero}${authForms}`;
  return layout({ title: 'LegendIdle - Avaleht', body, user, flash });
}

function renderGame({ user, flash }) {
  if (!user) {
    return layout({
      title: 'LegendIdle - Mäng',
      body: `<section class="card"><h3>Seanss puudub</h3><p>Sul puudub aktiivne seanss. Palun alusta avalehelt.</p><a class="button" href="/">Tagasi avalehele</a></section>`,
      user: null,
      flash,
    });
  }

  const progress = user.progress || { skills: {} };
  const skills = progress.skills || {};
  const skillList = Object.keys(skills).map((skill) => {
    const value = skills[skill];
    return `<li class="skill-item">
      <div>
        <strong>${escapeHtml(skill)}</strong>
        <span class="skill-value">Tase ${escapeHtml(String(value))}</span>
      </div>
      <form method="POST" action="/train" class="inline-form">
        <input type="hidden" name="skill" value="${escapeHtml(skill)}" />
        <button type="submit" class="button small">Treeni</button>
      </form>
    </li>`;
  }).join('');

  const guestRegister = user.isGuest
    ? `<section class="card">
        <h3>Muuda oma külaliskonto püsivaks</h3>
        <p>Saad säilitada kogu seni kogutud progressi, täites all oleva vormi.</p>
        <form method="POST" action="/register">
          <label for="upgrade-username">Kasutajanimi</label>
          <input id="upgrade-username" name="username" required maxlength="32" />
          <label for="upgrade-password">Parool</label>
          <input id="upgrade-password" name="password" type="password" required minlength="6" />
          <button type="submit" class="button primary">Loo konto ja salvesta progress</button>
        </form>
      </section>`
    : '';

  const body = `<section class="card">
      <h2>Tere tulemast tagasi, ${escapeHtml(user.username)}${user.isGuest ? ' (külaline)' : ''}!</h2>
      <p>See on mängu prototüübi peavaade. Siin saad treenida oma oskusi, vaadata statistikat ning tulevikus ka võidelda teiste mängijatega.</p>
    </section>
    <section class="card">
      <h3>Oskused</h3>
      <ul class="skill-list">
        ${skillList}
      </ul>
      <p class="help-text">Iga treening tõstab vastava oskuse taset ühe võrra. Tulevikus lisanduvad ressursid, varustus ja võitlus.</p>
    </section>
    ${guestRegister}
    <section class="card">
      <h3>Seansi haldus</h3>
      <form method="POST" action="/logout" class="inline-form">
        <button type="submit" class="button secondary">Logi välja</button>
      </form>
      <p class="help-text">Välja logides salvestatakse sinu progress, kui oled registreeritud mängija.</p>
    </section>`;

  return layout({ title: 'LegendIdle - Mäng', body, user, flash });
}

module.exports = {
  renderHome,
  renderGame,
};
