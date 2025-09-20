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

  const passwordScript = `<script>
    (function () {
      const forms = document.querySelectorAll('form[data-password-form]');
      if (!forms.length) {
        return;
      }

      const labels = { weak: 'Nõrk', medium: 'Keskmine', strong: 'Tugev' };
      const widths = { weak: '33%', medium: '66%', strong: '100%' };
      const availabilityEndpoint = '/availability';
      const debounceDelay = 300;

      function evaluateStrength(password) {
        let score = 0;
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/\d/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;
        if (score >= 5) {
          return 'strong';
        }
        if (score >= 3) {
          return 'medium';
        }
        return 'weak';
      }

      function setStatusMessage(target, status, message) {
        if (!target) {
          return;
        }
        target.textContent = message || '';
        target.classList.remove('success', 'error');
        if (status === 'success') {
          target.classList.add('success');
        } else if (status === 'error') {
          target.classList.add('error');
        }
      }

      forms.forEach(function (form) {
        const passwordInput = form.querySelector('[data-password-input]');
        const confirmInput = form.querySelector('[data-password-confirm]');
        const strengthContainer = form.querySelector('[data-password-strength]');
        const matchText = form.querySelector('[data-password-match]');
        const usernameInput = form.querySelector('[name="username"]');
        const emailInput = form.querySelector('[name="email"]');
        const usernameMessage = form.querySelector('[data-availability-username]');
        const emailMessage = form.querySelector('[data-availability-email]');
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');

        if (passwordInput && strengthContainer) {
          const fill = strengthContainer.querySelector('.password-strength-fill');
          const text = strengthContainer.querySelector('.password-strength-text');

          function updateStrength() {
            const value = passwordInput.value || '';
            if (!value) {
              fill.style.width = '0';
              fill.setAttribute('data-level', 'weak');
              if (text) {
                text.textContent = 'Sisesta parool, et näha tugevust';
              }
              return;
            }
            const level = evaluateStrength(value);
            fill.style.width = widths[level] || widths.weak;
            fill.setAttribute('data-level', level);
            if (text) {
              text.textContent = 'Parooli tugevus: ' + labels[level];
            }
          }

          function updateMatch() {
            if (!matchText || !confirmInput) {
              return;
            }
            if (!confirmInput.value) {
              matchText.textContent = '';
              matchText.classList.remove('success', 'error');
              return;
            }
            if (confirmInput.value === passwordInput.value) {
              matchText.textContent = 'Paroolid kattuvad.';
              matchText.classList.add('success');
              matchText.classList.remove('error');
            } else {
              matchText.textContent = 'Paroolid ei kattu.';
              matchText.classList.add('error');
              matchText.classList.remove('success');
            }
          }

          passwordInput.addEventListener('input', function () {
            updateStrength();
            updateMatch();
          });

          if (confirmInput) {
            confirmInput.addEventListener('input', updateMatch);
          }

          updateStrength();
        }

        let availabilityTimer = null;
        let lastRequestId = 0;
        let usernameAvailable = true;
        let emailAvailable = true;

        function updateSubmitState() {
          if (!submitButton) {
            return;
          }
          const disableUsername = usernameInput && usernameInput.value.trim() && !usernameAvailable;
          const disableEmail = emailInput && emailInput.value.trim() && !emailAvailable;
          submitButton.disabled = Boolean(disableUsername || disableEmail);
        }

        function scheduleAvailabilityCheck() {
          if (!usernameInput && !emailInput) {
            return;
          }
          if (availabilityTimer) {
            clearTimeout(availabilityTimer);
          }
          availabilityTimer = setTimeout(runAvailabilityCheck, debounceDelay);
        }

        async function runAvailabilityCheck() {
          const usernameValue = usernameInput ? usernameInput.value.trim() : '';
          const emailValue = emailInput ? emailInput.value.trim() : '';

          if (!usernameValue) {
            usernameAvailable = true;
            setStatusMessage(usernameMessage, null, '');
          }
          if (!emailValue) {
            emailAvailable = true;
            setStatusMessage(emailMessage, null, '');
          }

          if (!usernameValue && !emailValue) {
            updateSubmitState();
            return;
          }

          const params = new URLSearchParams();
          let shouldRequest = false;
          let requestedUsername = false;
          let requestedEmail = false;

          if (usernameValue) {
            params.set('username', usernameValue);
            shouldRequest = true;
            requestedUsername = true;
            setStatusMessage(usernameMessage, null, 'Kontrollin saadavust...');
          }

          if (emailValue) {
            if (!emailInput || emailInput.checkValidity()) {
              params.set('email', emailValue);
              shouldRequest = true;
              requestedEmail = true;
              setStatusMessage(emailMessage, null, 'Kontrollin saadavust...');
            } else {
              emailAvailable = false;
              setStatusMessage(emailMessage, 'error', 'Sisesta kehtiv e-posti aadress.');
            }
          }

          if (!shouldRequest) {
            updateSubmitState();
            return;
          }

          const requestId = ++lastRequestId;

          try {
            const response = await fetch(availabilityEndpoint + '?' + params.toString(), {
              headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) {
              throw new Error('Request failed');
            }
            const data = await response.json();
            if (requestId !== lastRequestId) {
              return;
            }

            if (requestedUsername) {
              usernameAvailable = data.usernameAvailable !== false;
              if (usernameAvailable) {
                setStatusMessage(usernameMessage, 'success', 'Kasutajanimi on saadaval.');
              } else {
                setStatusMessage(
                  usernameMessage,
                  'error',
                  'Selline kasutajanimi on juba kasutusel.'
                );
              }
            }

            if (requestedEmail) {
              emailAvailable = data.emailAvailable !== false;
              if (emailAvailable) {
                setStatusMessage(emailMessage, 'success', 'E-posti aadress on saadaval.');
              } else {
                setStatusMessage(
                  emailMessage,
                  'error',
                  'Sellise e-posti aadressiga konto on juba olemas.'
                );
              }
            }
          } catch (err) {
            if (requestId !== lastRequestId) {
              return;
            }
            console.error(err);
            setStatusMessage(
              usernameMessage,
              'error',
              requestedUsername && usernameValue ? 'Saadavuse kontroll ebaõnnestus.' : ''
            );
            setStatusMessage(
              emailMessage,
              'error',
              requestedEmail && emailValue ? 'Saadavuse kontroll ebaõnnestus.' : ''
            );
          } finally {
            updateSubmitState();
          }
        }

        if (usernameInput) {
          usernameInput.addEventListener('input', scheduleAvailabilityCheck);
        }
        if (emailInput) {
          emailInput.addEventListener('input', scheduleAvailabilityCheck);
        }

        scheduleAvailabilityCheck();
      });
    })();
  </script>`;

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
  ${passwordScript}
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
      <form method="POST" action="/register" data-password-form>
        <label for="register-username">Kasutajanimi</label>
        <input
          id="register-username"
          name="username"
          required
          maxlength="32"
          autocomplete="username"
        />
        <p class="availability-message" data-availability-username aria-live="polite"></p>
        <label for="register-email">E-posti aadress</label>
        <input
          id="register-email"
          name="email"
          type="email"
          required
          maxlength="255"
          autocomplete="email"
        />
        <p class="availability-message" data-availability-email aria-live="polite"></p>
        <label for="register-password">Parool</label>
        <input
          id="register-password"
          name="password"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          data-password-input
        />
        <div class="password-strength" data-password-strength>
          <div class="password-strength-bar">
            <span class="password-strength-fill" data-level="weak"></span>
          </div>
          <span class="password-strength-text">Sisesta parool, et näha tugevust</span>
        </div>
        <label for="register-confirm">Kinnita parool</label>
        <input
          id="register-confirm"
          name="confirmPassword"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          data-password-confirm
        />
        <p class="password-match" data-password-match aria-live="polite"></p>
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
        <form method="POST" action="/register" data-password-form>
          <label for="upgrade-username">Kasutajanimi</label>
          <input
            id="upgrade-username"
            name="username"
            required
            maxlength="32"
            autocomplete="username"
          />
          <p class="availability-message" data-availability-username aria-live="polite"></p>
          <label for="upgrade-email">E-posti aadress</label>
          <input
            id="upgrade-email"
            name="email"
            type="email"
            required
            maxlength="255"
            autocomplete="email"
          />
          <p class="availability-message" data-availability-email aria-live="polite"></p>
          <label for="upgrade-password">Parool</label>
          <input
            id="upgrade-password"
            name="password"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            data-password-input
          />
          <div class="password-strength" data-password-strength>
            <div class="password-strength-bar">
              <span class="password-strength-fill" data-level="weak"></span>
            </div>
            <span class="password-strength-text">Sisesta parool, et näha tugevust</span>
          </div>
          <label for="upgrade-confirm">Kinnita parool</label>
          <input
            id="upgrade-confirm"
            name="confirmPassword"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            data-password-confirm
          />
          <p class="password-match" data-password-match aria-live="polite"></p>
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
    ${guestRegister}`;

  return layout({ title: 'LegendIdle - Mäng', body, user, flash });
}

module.exports = {
  renderHome,
  renderGame,
};
