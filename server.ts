import express from 'express';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('crypto_race.db');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// Stripe Helper
let stripeInstance: Stripe | null = null;
function getStripe() {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is missing. Please set it in the Settings menu.');
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

// Nodemailer Transporter Helper
let transporterInstance: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporterInstance) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_PASS;

    if (!user || !pass) {
      throw new Error('GMAIL_USER or GMAIL_PASS environment variables are missing. Please set them in the Settings menu.');
    }

    transporterInstance = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transporterInstance;
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    balance REAL DEFAULT 1000.0,
    is_new_user INTEGER DEFAULT 1,
    is_verified INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    otp TEXT,
    expires_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    asset TEXT,
    amount REAL,
    outcome TEXT,
    profit REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    amount REAL,
    method TEXT,
    details TEXT,
    status TEXT DEFAULT 'COMPLETED',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS linked_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT, -- 'bank', 'paypal', 'card'
    account_name TEXT,
    account_number TEXT,
    details TEXT, -- JSON string for extra info like expiry, cvc, swift
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Bot Simulation System
  const botNames = [
    'crypto_king', 'moon_walker', 'whale_watcher', 'satoshi_fan', 'eth_bull',
    'bitcoin_babe', 'hodl_master', 'defi_ninja', 'altcoin_ace', 'block_explorer',
    'chain_link', 'ledger_lord', 'mining_mogul', 'token_titan', 'wallet_wizard',
    'gas_guru', 'swap_star', 'yield_yogi', 'nft_knight', 'meta_maven'
  ];

  // Create bot users if they don't exist
  botNames.forEach(name => {
    const email = `${name}@bot.com`;
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!existing) {
      db.prepare('INSERT INTO users (email, password, balance, is_verified) VALUES (?, ?, ?, ?)').run(
        email, 'bot-password', 10000, 1
      );
    }
  });

  // Simulate bot activity every 15-30 seconds
  setInterval(() => {
    const randomBot = botNames[Math.floor(Math.random() * botNames.length)];
    const botUser = db.prepare('SELECT * FROM users WHERE email = ?').get(`${randomBot}@bot.com`);
    if (!botUser) return;

    const asset = Math.random() > 0.5 ? 'BTC' : 'ETH';
    const amount = Math.floor(Math.random() * 90) + 10;
    const won = Math.random() > 0.5;
    const profit = won ? amount * 0.8 : -amount;
    const outcome = won ? 'WIN' : 'LOSE';

    db.prepare('INSERT INTO bets (user_id, asset, amount, outcome, profit) VALUES (?, ?, ?, ?, ?)').run(
      botUser.id, asset, amount, outcome, profit
    );

    broadcast({
      type: 'LIVE_ACTIVITY',
      data: {
        email: randomBot + '***',
        asset,
        amount,
        outcome,
        profit,
        timestamp: new Date().toISOString()
      }
    });
  }, 15000);

  // Stripe Webhook (needs raw body)
  app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).send('Webhook Error: Missing signature or secret');
    }

    let event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const amount = session.amount_total ? session.amount_total / 100 : 0;

      if (userId && amount > 0) {
        db.transaction(() => {
          const user: any = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
          const newBalance = user.balance + amount;
          db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);
          db.prepare('INSERT INTO transactions (user_id, type, amount, method, details, status) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, 'DEPOSIT', amount, 'STRIPE', JSON.stringify({ sessionId: session.id }), 'COMPLETED');
        })();
        console.log(`Stripe deposit successful for user ${userId}: $${amount}`);
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  // Stripe Callback Page
  app.get('/api/stripe/callback', (req, res) => {
    const { status } = req.query;
    res.send(`
      <html>
        <body style="background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
          <div style="text-align: center;">
            <h2 style="margin-bottom: 10px;">${status === 'success' ? 'Payment Successful!' : 'Payment Cancelled'}</h2>
            <p style="opacity: 0.7;">This window will close automatically...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'STRIPE_PAYMENT_RESULT', status: '${status}' }, '*');
              setTimeout(() => window.close(), 2000);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  });

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  app.post('/api/auth/guest', async (req, res) => {
    const guestId = Math.floor(Math.random() * 1000000);
    const email = `guest_${guestId}@guest.com`;
    const password = await bcrypt.hash('guest-password', 10);
    
    try {
      const info = db.prepare('INSERT INTO users (email, password, is_verified) VALUES (?, ?, 1)').run(email, password);
      const token = jwt.sign({ id: info.lastInsertRowid, email }, JWT_SECRET);
      res.json({ token, user: { id: info.lastInsertRowid, email, balance: 1000 } });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create guest user' });
    }
  });

  // Auth
  app.post('/api/auth/send-otp', async (req, res) => {
    let { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    email = email.trim().toLowerCase();

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    try {
      db.prepare('DELETE FROM otps WHERE email = ?').run(email);
      db.prepare('INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)').run(email, otp, expiresAt);

      // Check if credentials are still placeholders
      const isPlaceholder = !process.env.GMAIL_USER || !process.env.GMAIL_PASS || process.env.GMAIL_USER === 'your-email@gmail.com' || process.env.GMAIL_PASS === 'your-app-password';
      
      if (isPlaceholder) {
        console.log('------------------------------------------');
        console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
        console.log('------------------------------------------');
        return res.json({ 
          message: 'OTP logged to server console (Dev Mode).',
          devMode: true,
          otpHint: `Since Gmail is not configured, your OTP is: ${otp}`
        });
      }

      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"Crypto Race" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Your Signup OTP",
        text: `Your OTP for Crypto Race signup is: ${otp}. It expires in 10 minutes.`,
        html: `<b>Your OTP for Crypto Race signup is: ${otp}</b><p>It expires in 10 minutes.</p>`,
      });

      res.json({ message: 'OTP sent successfully' });
    } catch (e: any) {
      console.error('Email error:', e);
      
      // Fallback: Log to console so the user can still sign up during development
      console.log('------------------------------------------');
      console.log(`[FALLBACK] OTP for ${email}: ${otp}`);
      console.log('Reason: ' + e.message);
      console.log('------------------------------------------');

      let errorMessage = 'Failed to send email.';
      if (e.code === 'EAUTH' || e.message.includes('Invalid login')) {
        errorMessage = `Email auth failed. For testing, your OTP is: ${otp} (Check server logs). Please set a real Gmail App Password in Settings for production.`;
      }

      // We return 200 with a hint so the user isn't blocked
      res.json({ 
        message: 'OTP generated (Check server logs).',
        otpHint: `Your OTP is: ${otp}`,
        error: errorMessage 
      });
    }
  });

  app.post('/api/auth/signup', async (req, res) => {
    let { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    email = email.trim().toLowerCase();

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const info = db.prepare('INSERT INTO users (email, password, is_verified) VALUES (?, ?, 1)').run(email, hashedPassword);
      
      const token = jwt.sign({ id: info.lastInsertRowid, email }, JWT_SECRET);
      res.json({ token, user: { id: info.lastInsertRowid, email, balance: 1000 } });
    } catch (e) {
      res.status(400).json({ error: 'Email already exists or signup failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    let { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    email = email.trim().toLowerCase();
    
    const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, balance: user.balance } });
  });

  // User Data
  app.get('/api/user/me', authenticateToken, (req: any, res) => {
    const user: any = db.prepare('SELECT id, email, balance FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  });

  app.post('/api/user/deposit', authenticateToken, (req: any, res) => {
    const { amount, method, details } = req.body;
    const userId = req.user.id;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!method || !details) return res.status(400).json({ error: 'Payment method and details are required' });

    // In a real app, this would initiate a payment gateway session.
    // Here we simulate a "PENDING" state that needs "SUCCESS" confirmation.
    const info = db.prepare('INSERT INTO transactions (user_id, type, amount, method, details, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, 'DEPOSIT', amount, method, JSON.stringify(details), 'PENDING');

    res.json({ 
      message: 'Deposit initiated. Please complete the payment.',
      transactionId: info.lastInsertRowid 
    });
  });

  app.post('/api/user/deposit/stripe-session', authenticateToken, async (req: any, res) => {
    const { amount } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    if (!amount || amount < 5) {
      return res.status(400).json({ error: 'Minimum deposit is $5' });
    }

    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Crypto Race Deposit',
                description: `Deposit for user ${userEmail}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/api/stripe/callback?status=success`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/api/stripe/callback?status=cancel`,
        customer_email: userEmail,
        metadata: {
          userId: userId.toString(),
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error('Stripe session error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to create payment session' });
    }
  });

  app.post('/api/user/deposit/confirm', authenticateToken, (req: any, res) => {
    const { transactionId } = req.body;
    const userId = req.user.id;

    const tx: any = db.prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ? AND status = 'PENDING'").get(transactionId, userId);
    if (!tx) return res.status(404).json({ error: 'Pending transaction not found' });

    // Mark as completed and update balance
    db.prepare("UPDATE transactions SET status = 'COMPLETED' WHERE id = ?").run(transactionId);
    
    const user: any = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    const newBalance = user.balance + tx.amount;
    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);

    res.json({ balance: newBalance, message: 'Deposit successful!' });
  });

  app.post('/api/user/withdraw', authenticateToken, (req: any, res) => {
    const { amount, method, details } = req.body;
    const userId = req.user.id;
    
    if (!amount || amount < 5 || amount > 500) {
      return res.status(400).json({ error: 'Withdrawal amount must be between $5 and $500' });
    }
    if (!method || !details) return res.status(400).json({ error: 'Withdrawal method and details are required' });

    const user: any = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const newBalance = user.balance - amount;
    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);
    db.prepare('INSERT INTO transactions (user_id, type, amount, method, details, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, 'WITHDRAWAL', -amount, method, JSON.stringify(details), 'COMPLETED');

    res.json({ balance: newBalance });
  });

  // --- Linked Accounts ---
  app.get('/api/user/linked-accounts', authenticateToken, (req: any, res) => {
    const accounts = db.prepare('SELECT * FROM linked_accounts WHERE user_id = ?').all(req.user.id);
    res.json(accounts.map((a: any) => ({ ...a, details: JSON.parse(a.details || '{}') })));
  });

  app.post('/api/user/link-account', authenticateToken, (req: any, res) => {
    const { type, accountName, accountNumber, details } = req.body;
    if (!type || !accountName || !accountNumber) return res.status(400).json({ error: 'Missing fields' });

    try {
      const info = db.prepare('INSERT INTO linked_accounts (user_id, type, account_name, account_number, details) VALUES (?, ?, ?, ?, ?)')
        .run(req.user.id, type, accountName, accountNumber, JSON.stringify(details || {}));
      res.json({ id: info.lastInsertRowid, message: 'Account linked successfully' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to link account' });
    }
  });

  app.delete('/api/user/unlink-account/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM linked_accounts WHERE id = ? AND user_id = ?').run(id, req.user.id);
      res.json({ message: 'Account unlinked successfully' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to unlink account' });
    }
  });

  // Game Logic
  app.post('/api/game/bet', authenticateToken, async (req: any, res) => {
    const { asset, amount } = req.body;
    const userId = req.user.id;

    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    // Simulate Race with a random walk (10 steps)
    const steps = 10;
    const btcPath = [0];
    const ethPath = [0];
    let btcPos = 0;
    let ethPos = 0;

    for (let i = 0; i < steps; i++) {
      // Each step adds a random increment (0-15)
      btcPos += Math.random() * 15;
      ethPos += Math.random() * 15;
      btcPath.push(btcPos);
      ethPath.push(ethPos);
    }

    const winner = btcPos > ethPos ? 'BTC' : 'ETH';
    const won = asset === winner;

    let profit = 0;
    let newBalance = user.balance;

    if (won) {
      profit = amount * 0.8;
      newBalance += profit;
    } else {
      // First loss refund logic
      if (user.is_new_user === 1) {
        // Refunded
        profit = 0;
        db.prepare('UPDATE users SET is_new_user = 0 WHERE id = ?').run(userId);
      } else {
        profit = -amount;
        newBalance -= amount;
      }
    }

    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);
    db.prepare('INSERT INTO bets (user_id, asset, amount, outcome, profit) VALUES (?, ?, ?, ?, ?)')
      .run(userId, asset, amount, won ? 'WIN' : 'LOSS', profit);

    // Broadcast live activity
    broadcast({
      type: 'LIVE_ACTIVITY',
      data: {
        email: user.email.split('@')[0] + '***',
        asset,
        amount,
        outcome: won ? 'WIN' : 'LOSS',
        profit,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      winner,
      won,
      profit,
      newBalance,
      refunded: !won && user.is_new_user === 1,
      paths: { BTC: btcPath, ETH: ethPath }
    });
  });

  app.get('/api/game/history', (req: any, res) => {
    const history = db.prepare(`
      SELECT b.*, u.email 
      FROM bets b 
      JOIN users u ON b.user_id = u.id 
      ORDER BY b.timestamp DESC 
      LIMIT 10
    `).all();
    res.json(history.map((h: any) => ({
      ...h,
      email: h.email.split('@')[0] + '***'
    })));
  });

  app.get('/api/game/leaderboard', (req, res) => {
    const leaderboard = db.prepare('SELECT email, balance FROM users ORDER BY balance DESC LIMIT 5').all();
    res.json(leaderboard.map((entry: any) => ({
      ...entry,
      email: entry.email.split('@')[0] + '***'
    })));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
