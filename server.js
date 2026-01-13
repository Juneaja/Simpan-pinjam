const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const SECRET_KEY = 'your-secret-key'; // Ganti dengan key aman

function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.post('/login', (req, res) => {
  const { username, password, role } = req.body;
  db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, role], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY);
      res.json({ token });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  });
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (username, password, role, balance) VALUES (?, ?, ?, ?)',
    [username, hashedPassword, 'member', 0], function(err) {
      if (err) return res.status(400).json({ message: 'Username exists or error' });
      res.json({ message: 'Registered successfully' });
    });
});

app.get('/balance', authenticateToken, (req, res) => {
  db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json({ balance: row.balance });
  });
});

app.post('/deposit', authenticateToken, (req, res) => {
  if (req.user.role !== 'member') return res.sendStatus(403);
  const { amount } = req.body;
  if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
  db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, req.user.id], function(err) {
    if (err) return res.status(500).json({ message: 'Database error' });
    db.run('INSERT INTO transactions (userId, type, amount, date) VALUES (?, ?, ?, ?)',
      [req.user.id, 'deposit', amount, new Date().toISOString()], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
          res.json({ balance: row.balance });
        });
      });
  });
});

app.post('/loan', authenticateToken, (req, res) => {
  if (req.user.role !== 'member') return res.sendStatus(403);
  const { amount } = req.body;
  if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
  db.run('INSERT INTO transactions (userId, type, amount, status, date) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, 'loan', amount, 'pending', new Date().toISOString()], function(err) {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json({ message: 'Loan request submitted' });
    });
});

app.get('/reports', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  db.all('SELECT * FROM users', [], (err, users) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    db.all('SELECT * FROM transactions', [], (err, transactions) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json({ users, transactions });
    });
  });
});

app.post('/approve-loan/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  db.get('SELECT * FROM transactions WHERE id = ? AND type = ? AND status = ?',
    [req.params.id, 'loan', 'pending'], (err, loan) => {
      if (err || !loan) return res.status(400).json({ message: 'Loan not found or already processed' });
      db.run('UPDATE transactions SET status = ? WHERE id = ?', ['approved', req.params.id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [loan.amount, loan.userId], (err) => {
          if (err) return res.status(500).json({ message: 'Database error' });
          res.json({ message: 'Loan approved' });
        });
      });
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));
