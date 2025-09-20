const http = require('http');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { renderHome, renderGame } = require('./templates');
const {
  findUser,
  createUser,
  updateUserProgress,
  isUsernameTaken,
  isEmailTaken,
} = require('./userStore');
const { defaultProgress, cloneProgress } = require('./progress');
const { initDb } = require('./db');

const PORT = process.env.PORT || 3000;
const sessionStore = new Map();
const USERNAME_RULES_MESSAGE =
  'Kasutajanimi peab olema 3-12 märki, sisaldama vähemalt ühte tähte ning võib koosneda vaid tähtedest, numbritest, tühikutest ja alakriipsudest.';
const USERNAME_ALLOWED_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž0-9 _]+$/;
const USERNAME_LETTER_PATTERN = /[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]/;

function parseCookies(header) {
  if (!header) {
    return {};
  }
  return header.split(';').reduce((acc, part) => {
    const [name, ...rest] = part.trim().split('=');
    if (!name) {
      return acc;
    }
    const value = rest.join('=');
    acc[name] = decodeURIComponent(value || '');
    return acc;
  }, {});
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge) {
    segments.push(`Max-Age=${options.maxAge}`);
  }
  if (options.path) {
    segments.push(`Path=${options.path}`);
  }
  if (options.httpOnly) {
    segments.push('HttpOnly');
  }
  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }
  if (options.secure) {
    segments.push('Secure');
  }
  return segments.join('; ');
}

function attachSession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  let sessionId = cookies.sid;
  let session = sessionId ? sessionStore.get(sessionId) : undefined;
  if (!session) {
    sessionId = crypto.randomUUID();
    session = {};
    sessionStore.set(sessionId, session);
  }
  req.session = session;
  req.sessionId = sessionId;
  res.setHeader(
    'Set-Cookie',
    serializeCookie('sid', sessionId, {
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    })
  );
}

function resetSession(req, res) {
  if (req.sessionId) {
    sessionStore.delete(req.sessionId);
  }
  const newId = crypto.randomUUID();
  const session = {};
  sessionStore.set(newId, session);
  req.session = session;
  req.sessionId = newId;
  res.setHeader(
    'Set-Cookie',
    serializeCookie('sid', newId, {
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    })
  );
  return session;
}

function setFlash(session, type, message) {
  session.flash = { type, message };
}

function getFlash(session) {
  if (!session) {
    return null;
  }
  const flash = session.flash || null;
  if (session.flash) {
    delete session.flash;
  }
  return flash;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashed}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) {
    return false;
  }
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  const storedBuffer = Buffer.from(key, 'hex');
  const hashedBuffer = Buffer.from(hashed, 'hex');
  if (storedBuffer.length !== hashedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(storedBuffer, hashedBuffer);
}

function sendHtml(res, html, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
  });
  res.end(html);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
      if (data.length > 1e6) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(data || '{}');
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      } else {
        const params = new URLSearchParams(data);
        const body = {};
        for (const [key, value] of params.entries()) {
          body[key] = value;
        }
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

async function serveStyles(res) {
  const filePath = path.join(__dirname, '../public/styles.css');
  try {
    const css = await fs.readFile(filePath, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    });
    res.end(css);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Stylesheet not found');
  }
}

function isValidEmail(email) {
  if (!email) {
    return false;
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function isValidUsername(username) {
  if (!username) {
    return false;
  }
  if (username.length < 3 || username.length > 12) {
    return false;
  }
  if (!USERNAME_ALLOWED_PATTERN.test(username)) {
    return false;
  }
  return USERNAME_LETTER_PATTERN.test(username);
}

async function handleRegister(req, res) {
  const body = await parseBody(req);
  const username = (body.username || '').trim();
  const email = (body.email || '').trim();
  const password = body.password || '';
  const confirmPassword = body.confirmPassword || '';
  const session = req.session;

  if (session.user && !session.user.isGuest) {
    setFlash(session, 'error', 'Oled juba sisse logitud. Uue konto loomiseks logi palun kõigepealt välja.');
    redirect(res, '/game');
    return;
  }

  if (!username || !password || !email) {
    setFlash(session, 'error', 'Kasutajanimi, e-posti aadress ja parool peavad olema täidetud.');
    redirect(res, '/');
    return;
  }

  if (!isValidUsername(username)) {
    setFlash(session, 'error', USERNAME_RULES_MESSAGE);
    redirect(res, '/');
    return;
  }

  if (!isValidEmail(email)) {
    setFlash(session, 'error', 'Palun sisesta kehtiv e-posti aadress.');
    redirect(res, '/');
    return;
  }

  if (password !== confirmPassword) {
    setFlash(session, 'error', 'Sisestatud paroolid ei kattu.');
    redirect(res, '/');
    return;
  }

  if (password.length < 8) {
    setFlash(session, 'error', 'Parool peab olema vähemalt 8 tähemärki pikk.');
    redirect(res, '/');
    return;
  }

  const wasGuest = !!session.user && session.user.isGuest;
  const progress = wasGuest ? cloneProgress(session.user.progress) : defaultProgress();

  try {
    const passwordHash = hashPassword(password);
    const user = await createUser({ username, email, passwordHash, progress });
    session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      isGuest: false,
      progress: cloneProgress(user.progress),
    };
    setFlash(
      session,
      'success',
      wasGuest
        ? 'Konto loodud! Sinu külalisena kogutud progress salvestati uude kontosse.'
        : 'Konto loodud! Nüüd saad LegendIdle maailma avastada isikliku kasutajaga.'
    );
    redirect(res, '/game');
  } catch (err) {
    if (err.code === 'USER_EXISTS') {
      setFlash(session, 'error', 'Sellise kasutajanimega konto on juba olemas. Palun vali uus nimi.');
      redirect(res, '/');
    } else if (err.code === 'EMAIL_EXISTS') {
      setFlash(
        session,
        'error',
        'Sellise e-posti aadressiga konto on juba olemas. Palun kasuta teist aadressi või logi sisse.'
      );
      redirect(res, '/');
    } else {
      console.error('Register error:', err);
      setFlash(session, 'error', 'Konto loomisel tekkis ootamatu viga. Proovi uuesti.');
      redirect(res, '/');
    }
  }
}

async function handleAvailability(res, searchParams) {
  const username = (searchParams.get('username') || '').trim();
  const email = (searchParams.get('email') || '').trim();

  if (!username && !email) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Missing username or email' }));
    return;
  }

  try {
    const usernameValid = !username || isValidUsername(username);
    let usernameAvailable = true;
    if (username) {
      if (usernameValid) {
        usernameAvailable = !(await isUsernameTaken(username));
      } else {
        usernameAvailable = false;
      }
    }

    const emailAvailable = email ? !(await isEmailTaken(email)) : true;

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        usernameAvailable,
        emailAvailable,
        ...(username
          ? {
              usernameValid,
              usernameMessage: usernameValid ? undefined : USERNAME_RULES_MESSAGE,
            }
          : {}),
      })
    );
  } catch (err) {
    console.error('Availability check error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Availability check failed' }));
  }
}

async function handleLogin(req, res) {
  const body = await parseBody(req);
  const username = (body.username || '').trim();
  const password = body.password || '';
  const session = req.session;

  if (!username || !password) {
    setFlash(session, 'error', 'Palun täida kasutajanimi ja parool.');
    redirect(res, '/');
    return;
  }

  const user = await findUser(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    setFlash(session, 'error', 'Sisselogimine ebaõnnestus. Kontrolli kasutajanime ja parooli.');
    redirect(res, '/');
    return;
  }

  session.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    isGuest: false,
    progress: cloneProgress(user.progress || defaultProgress()),
  };
  setFlash(session, 'success', 'Tere tulemast tagasi LegendIdle maailma!');
  redirect(res, '/game');
}

async function handleGuest(req, res) {
  const session = req.session;
  const guestName = `Külaline-${crypto.randomUUID().slice(0, 4)}`;
  session.user = {
    id: `guest-${crypto.randomUUID()}`,
    username: guestName,
    isGuest: true,
    progress: defaultProgress(),
  };
  setFlash(session, 'success', 'Alustasid mängu külalise rollis. Head seiklemist!');
  redirect(res, '/game');
}

async function handleTrain(req, res) {
  const session = req.session;
  if (!session.user) {
    setFlash(session, 'error', 'Treening ebaõnnestus, sest sa ei ole sisse logitud.');
    redirect(res, '/');
    return;
  }

  const body = await parseBody(req);
  const skill = body.skill;
  if (!skill) {
    setFlash(session, 'error', 'Oskust ei leitud.');
    redirect(res, '/game');
    return;
  }

  const progress = session.user.progress || defaultProgress();
  progress.skills = progress.skills || {};

  if (typeof progress.skills[skill] !== 'number') {
    setFlash(session, 'error', 'Valitud oskust ei saa hetkel treenida.');
    redirect(res, '/game');
    return;
  }

  progress.skills[skill] += 1;
  progress.lastTraining = new Date().toISOString();
  session.user.progress = progress;

  if (!session.user.isGuest) {
    await updateUserProgress(session.user.id, cloneProgress(progress));
  }

  setFlash(session, 'success', `${skill} oskuse tase tõusis!`);
  redirect(res, '/game');
}

async function handleLogout(req, res) {
  resetSession(req, res);
  setFlash(req.session, 'success', 'Oled edukalt välja logitud. Näeme varsti taas LegendIdle maailmas!');
  redirect(res, '/');
}

const server = http.createServer(async (req, res) => {
  try {
    attachSession(req, res);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (req.method === 'GET' && pathname === '/') {
      const html = renderHome({ user: req.session.user || null, flash: getFlash(req.session) });
      sendHtml(res, html);
      return;
    }

    if (req.method === 'GET' && pathname === '/game') {
      const html = renderGame({ user: req.session.user || null, flash: getFlash(req.session) });
      sendHtml(res, html);
      return;
    }

    if (req.method === 'GET' && pathname === '/availability') {
      await handleAvailability(res, url.searchParams);
      return;
    }

    if (req.method === 'GET' && pathname === '/styles.css') {
      await serveStyles(res);
      return;
    }

    if (req.method === 'POST' && pathname === '/register') {
      await handleRegister(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/login') {
      await handleLogin(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/guest') {
      await handleGuest(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/train') {
      await handleTrain(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/logout') {
      await handleLogout(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Lehte ei leitud.');
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Sisemine serveri viga.');
  }
});

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`LegendIdle prototüüp töötab aadressil http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Andmebaasi lähtestamine ebaõnnestus:', err);
    process.exit(1);
  });
