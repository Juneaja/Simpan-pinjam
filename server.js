const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const SECRET_KEY = 'your-secret-key'; // Ganti dengan key aman

let users = JSON.parse(fs.readFileSync('data/users.json'));
let transactions = JSON.parse(fs.readFileSync('data/transactions.json'));

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
  const user = users.find(u => u.username === username && u.role === role);
  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY);
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) return res.status(400).json({ message: 'Username exists' });
  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = { id: users.length + 1, username, password: hashedPassword, role: 'member', balance: 0 };
  users.push(newUser);
  fs.writeFileSync('data/users.json', JSON.stringify(users));
  res.json({ message: 'Registered successfully' });
});

app.get('/balance', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  res.json({ balance: user.balance });
});

app.post('/deposit', authenticateToken, (req, res) => {
  if (req.user.role !== 'member') return res.sendStatus(403);
  const { amount } = req.body;
  if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
  const user = users.find(u => u.id === req.user.id);
  user.balance += amount;
  transactions.push({ id: transactions.length + 1, userId: req.user.id, type: 'deposit', amount, date: new Date() });
  fs.writeFileSync('data/users.json', JSON.stringify(users));
  fs.writeFileSync('data/transactions.json', JSON.stringify(transactions));
  res.json({ balance: user.balance });
});

app.post('/loan', authenticateToken, (req, res) => {
  if (req.user.role !== 'member') return res.sendStatus(403);
  const { amount } = req.body;
  if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
  transactions.push({ id: transactions.length + 1, userId: req.user.id, type: 'loan', amount, status: 'pending', date: new Date() });
  fs.writeFileSync('data/transactions.json', JSON.stringify(transactions));
  res.json({ message: 'Loan request submitted' });
});

app.get('/reports', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  res.json({ users, transactions });
});

app.post('/approve-loan/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const loan = transactions.find(t => t.id == req.params.id && t.type === 'loan');
  if (loan && loan.status === 'pending') {
    loan.status = 'approved';
    const user = users.find(u => u.id === loan.userId);
    user.balance += loan.amount;
    fs.writeFileSync('data/transactions.json', JSON.stringify(transactions));
    fs.writeFileSync('data/users.json', JSON.stringify(users));
    res.json({ message: 'Loan approved' });
  } else {
    res.status(400).json({ message: 'Loan not found or already processed' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
