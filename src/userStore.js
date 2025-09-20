const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const dataFile = path.join(__dirname, '../data/users.json');

async function ensureStore() {
  try {
    await fs.access(dataFile);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(path.dirname(dataFile), { recursive: true });
      await fs.writeFile(dataFile, '[]', 'utf8');
    } else {
      throw err;
    }
  }
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

async function readUsers() {
  await ensureStore();
  const raw = await fs.readFile(dataFile, 'utf8');
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse user store, resetting to empty array.', err);
    await fs.writeFile(dataFile, '[]', 'utf8');
    return [];
  }
}

async function writeUsers(users) {
  await ensureStore();
  await fs.writeFile(dataFile, JSON.stringify(users, null, 2), 'utf8');
}

async function findUser(username) {
  const users = await readUsers();
  const normalized = normalizeUsername(username);
  return users.find((user) => user.normalized === normalized) || null;
}

async function createUser({ username, passwordHash, progress }) {
  const users = await readUsers();
  const normalized = normalizeUsername(username);
  if (users.some((user) => user.normalized === normalized)) {
    const error = new Error('Username already exists.');
    error.code = 'USER_EXISTS';
    throw error;
  }

  const newUser = {
    id: crypto.randomUUID(),
    username: username.trim(),
    normalized,
    passwordHash,
    createdAt: new Date().toISOString(),
    progress,
  };

  users.push(newUser);
  await writeUsers(users);
  return newUser;
}

async function updateUserProgress(id, progress) {
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) {
    return null;
  }

  users[index].progress = progress;
  users[index].updatedAt = new Date().toISOString();
  await writeUsers(users);
  return users[index];
}

module.exports = {
  readUsers,
  writeUsers,
  findUser,
  createUser,
  updateUserProgress,
};
