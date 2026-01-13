const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./simpan_pinjam.db');

// Buat tabel jika belum ada
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    balance REAL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    type TEXT,
    amount REAL,
    status TEXT DEFAULT NULL,
    date TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  )`);

  // Data awal (admin)
  db.run(`INSERT OR IGNORE INTO users (username, password, role, balance) VALUES (?, ?, ?, ?)`,
    ['admin', '$2a$10$examplehashedpassword', 'admin', 0]); // Ganti hash dengan bcrypt untuk "admin123"
});

module.exports = db;
