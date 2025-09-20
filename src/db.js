const mysql = require('mysql2/promise');

let pool;

function getConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'legendidle',
    waitForConnections: true,
    connectionLimit: process.env.DB_CONNECTION_LIMIT
      ? Number(process.env.DB_CONNECTION_LIMIT)
      : 10,
    namedPlaceholders: true,
  };
}

async function ensureDatabase(config) {
  const { database, ...connectionConfig } = config;
  const connection = await mysql.createConnection(connectionConfig);
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function initDb() {
  const config = getConfig();
  await ensureDatabase(config);
  pool = mysql.createPool(config);
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        normalized VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        gold INT NOT NULL DEFAULT 0,
        last_training DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL,
        UNIQUE KEY users_normalized_unique (normalized),
        UNIQUE KEY users_email_unique (email)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_skills (
        user_id INT NOT NULL,
        skill_name VARCHAR(50) NOT NULL,
        level INT NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, skill_name),
        CONSTRAINT fk_user_skills_user FOREIGN KEY (user_id)
          REFERENCES users(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
  } finally {
    connection.release();
  }

  return pool;
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDb() before using it.');
  }
  return pool;
}

module.exports = {
  initDb,
  getPool,
};
