const { getPool } = require('./db');
const { defaultProgress, cloneProgress } = require('./progress');

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function mapSkillsToProgress(skillRows, baseProgress) {
  const progress = cloneProgress(baseProgress);
  for (const row of skillRows) {
    progress.skills[row.skill_name] = row.level;
  }
  return progress;
}

async function findUser(username) {
  const pool = getPool();
  const normalized = normalizeUsername(username);
  const [rows] = await pool.query(
    `SELECT id, username, email, password_hash AS passwordHash, gold, last_training AS lastTraining
     FROM users
     WHERE normalized = ?`,
    [normalized]
  );

  if (rows.length === 0) {
    return null;
  }

  const userRow = rows[0];
  const [skillRows] = await pool.query(
    `SELECT skill_name, level
     FROM user_skills
     WHERE user_id = ?`,
    [userRow.id]
  );

  const baseProgress = defaultProgress();
  baseProgress.gold = typeof userRow.gold === 'number' ? userRow.gold : baseProgress.gold;
  baseProgress.lastTraining = userRow.lastTraining
    ? new Date(userRow.lastTraining).toISOString()
    : null;
  const progress = mapSkillsToProgress(skillRows, baseProgress);

  return {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    passwordHash: userRow.passwordHash,
    progress,
  };
}

async function isUsernameTaken(username) {
  if (!username) {
    return false;
  }
  const pool = getPool();
  const normalized = normalizeUsername(username);
  const [rows] = await pool.query(
    `SELECT 1
     FROM users
     WHERE normalized = ?
     LIMIT 1`,
    [normalized]
  );
  return rows.length > 0;
}

async function isEmailTaken(email) {
  if (!email) {
    return false;
  }
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT 1
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  return rows.length > 0;
}

async function createUser({ username, email, passwordHash, progress }) {
  const pool = getPool();
  const normalized = normalizeUsername(username);
  const cleanProgress = cloneProgress(progress || defaultProgress());
  cleanProgress.skills = {
    ...defaultProgress().skills,
    ...(cleanProgress.skills || {}),
  };
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO users (username, normalized, email, password_hash, gold, last_training)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        username.trim(),
        normalized,
        email,
        passwordHash,
        cleanProgress.gold ?? 0,
        cleanProgress.lastTraining ? new Date(cleanProgress.lastTraining) : null,
      ]
    );

    const userId = result.insertId;
    const skillEntries = Object.entries(cleanProgress.skills);
    for (const [skillName, level] of skillEntries) {
      await connection.query(
        `INSERT INTO user_skills (user_id, skill_name, level)
         VALUES (?, ?, ?)`,
        [userId, skillName, level]
      );
    }

    await connection.commit();

    return {
      id: userId,
      username: username.trim(),
      email,
      passwordHash,
      progress: cleanProgress,
    };
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('users_normalized_unique')) {
        const error = new Error('Username already exists.');
        error.code = 'USER_EXISTS';
        throw error;
      }
      if (err.message.includes('users_email_unique')) {
        const error = new Error('Email already exists.');
        error.code = 'EMAIL_EXISTS';
        throw error;
      }
    }
    throw err;
  } finally {
    connection.release();
  }
}

async function updateUserProgress(id, progress) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const cleanProgress = cloneProgress(progress || defaultProgress());
  cleanProgress.skills = {
    ...defaultProgress().skills,
    ...(cleanProgress.skills || {}),
  };

  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE users
       SET gold = ?, last_training = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        cleanProgress.gold ?? 0,
        cleanProgress.lastTraining ? new Date(cleanProgress.lastTraining) : null,
        id,
      ]
    );

    const skillEntries = Object.entries(cleanProgress.skills || {});
    for (const [skillName, level] of skillEntries) {
      await connection.query(
        `INSERT INTO user_skills (user_id, skill_name, level)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE level = VALUES(level)`,
        [id, skillName, level]
      );
    }

    await connection.commit();
    return cleanProgress;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  findUser,
  createUser,
  updateUserProgress,
  isUsernameTaken,
  isEmailTaken,
};
