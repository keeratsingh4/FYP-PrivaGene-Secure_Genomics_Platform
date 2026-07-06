// db/db.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const DB_FILE = path.join(__dirname, '..', 'app.db');

function ensureDBFolder() {
  const dbDir = path.dirname(DB_FILE);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
}

ensureDBFolder();

const db = new sqlite3.Database(DB_FILE);

function runMigrations(exitOnComplete = false) {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations.sql'), 'utf8');
  db.exec(sql, (err) => {
    if (err) {
      console.error('Migration error:', err);
      if (exitOnComplete) process.exit(1);
    } else {
      console.log('Migrations applied successfully.');
      if (exitOnComplete) process.exit(0);
    }
  });
}

// helper to run statements returning Promise
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = { db, runMigrations, run, get, all, DB_FILE };