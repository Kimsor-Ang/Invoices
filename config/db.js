// Database connection configuration (PostgreSQL)
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load local .env for development without requiring extra dependencies.
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  require('node:process').loadEnvFile(envPath);
}

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
    }
  : {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD
    };

const db = new Pool(poolConfig);

async function testConnection() {
  try {
    await db.query('SELECT 1');
    console.log('✓ Database connected successfully! (PostgreSQL)');
    if (process.env.DATABASE_URL) {
      console.log('✓ Using DATABASE_URL connection');
    } else {
      console.log(
        `✓ Database target: ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`
      );
    }
  } catch (err) {
    const errorDetails =
      err instanceof Error
        ? `${err.name}: ${err.message}\n${err.stack || ''}`.trim()
        : JSON.stringify(err);

    console.error('✗ Database connection failed:\n', errorDetails);
    if (!process.env.DATABASE_URL) {
      console.error(
        `Connection config -> host: ${poolConfig.host}, port: ${poolConfig.port}, database: ${poolConfig.database}, user: ${poolConfig.user}`
      );
    }
    process.exit(1);
  }
}

module.exports = { db, testConnection };
