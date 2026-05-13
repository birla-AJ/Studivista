const { Pool } = require('pg');

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'studivista',
  user:     process.env.DB_USER     || 'studivistauser',
  password: required('DB_PASSWORD'),
});

pool.on('error', (err) => console.error('PostgreSQL error:', err));

module.exports = { pool };
