import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import admin from 'firebase-admin';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = admin.firestore();
if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
  db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
}
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// Stripe Helper
let stripeInstance: Stripe | null = null;
let isStripeMocked = false;

function getStripe() {
  if (!stripeInstance && !isStripeMocked) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.warn('STRIPE_SECRET_KEY is missing. Switching to MOCK MODE.');
      isStripeMocked = true;
      return null;
    }
    stripeInstance = new Stripe(key, {
      apiVersion: '2025-02-24.acacia' as any,
    });
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

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  console.log('Starting server with APP_URL:', process.env.APP_URL || 'http://localhost:3000');

  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Bot Simulation System (Adapted for Firestore)
  const botNames = [
    'crypto_king', 'moon_walker', 'whale_watcher', 'satoshi_fan', 'eth_bull',
    'bitcoin_babe', 'hodl_master', 'defi_ninja', 'altcoin_ace', 'block_explorer',
    'chain_link', 'ledger_lord', 'mining_mogul', 'token_titan', 'wallet_wizard',
    'gas_guru', 'swap_star', 'yield_yogi', 'nft_knight', 'meta_maven'
  ];

  // Simulate bot activity every 15-30 seconds
  setInterval(async () => {
    const randomBot = botNames[Math.floor(Math.random() * botNames.length)];
    const asset = Math.random() > 0.5 ? 'BTC' : 'ETH';
    const amount = Math.floor(Math.random() * 90) + 10;
    const won = Math.random() > 0.5;
    const profit = won ? amount * 0.8 : -amount;
    const outcome = won ? 'WIN' : 'LOSE';

    // In a real app, we might store this in a global_history collection
    const activity = {
      email: randomBot + '***',
      asset,
      amount,
      outcome,
      profit,
      timestamp: new Date().toISOString()
    };

    try {
      await db.collection('global_history').add(activity);
      broadcast({ type: 'LIVE_ACTIVITY', data: activity });
    } catch (e) {
      console.error('Failed to save bot activity', e);
    }
  }, 15000);

  // Stripe Webhook (needs raw body)
  app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      console.error('Stripe webhook error: Missing signature or secret', { sig: !!sig, secret: !!webhookSecret });
      return res.status(400).send('Webhook Error: Missing signature or secret');
    }

    let event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log('Stripe webhook event received:', event.type);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const amount = session.amount_total ? session.amount_total / 100 : 0;

      console.log(`Processing checkout.session.completed for user ${userId}, amount ${amount}`);

      if (userId && amount > 0) {
        try {
          await db.runTransaction(async (t) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await t.get(userRef);
            
            if (!userDoc.exists) {
              console.error(`User ${userId} not found during webhook processing`);
              return;
            }

            const currentBalance = userDoc.data()?.balance || 0;
            const newBalance = currentBalance + amount;

            t.update(userRef, { balance: newBalance });
            
            const txRef = userRef.collection('transactions').doc();
            t.set(txRef, {
              type: 'DEPOSIT',
              amount: amount,
              method: 'STRIPE',
              details: JSON.stringify({ sessionId: session.id }),
              status: 'COMPLETED',
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
          });
          console.log(`Stripe deposit successful for user ${userId}: $${amount}`);
        } catch (dbErr: any) {
          console.error('Database error during Stripe webhook processing:', dbErr.message);
        }
      }
    }

    res.json({ received: true });
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

  // Mock Stripe Checkout Page
  app.get('/api/stripe/mock-checkout', (req, res) => {
    const { amount, email, userId } = req.query;
    res.send(`
      <html>
        <head>
          <title>Mock Stripe Checkout</title>
          <style>
            body { background: #0f172a; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 40px; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); max-width: 400px; width: 100%; text-align: center; border: 1px solid rgba(255,255,255,0.1); }
            .btn { display: block; width: 100%; padding: 15px; margin-top: 20px; border-radius: 10px; border: none; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .btn-primary { background: #3b82f6; color: white; }
            .btn-primary:hover { background: #2563eb; }
            .btn-ghost { background: transparent; color: #94a3b8; border: 1px solid #334155; margin-top: 10px; }
            .btn-ghost:hover { background: rgba(255,255,255,0.05); }
            .badge { background: #f59e0b; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 20px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">Mock Mode</div>
            <h1 style="margin: 0 0 10px 0;">Checkout</h1>
            <p style="color: #94a3b8; margin-bottom: 30px;">Deposit for ${email}</p>
            <div style="font-size: 48px; font-weight: 900; margin-bottom: 30px;">$${amount}</div>
            
            <button class="btn btn-primary" onclick="handleSuccess()">Pay Now (Simulated)</button>
            <button class="btn btn-ghost" onclick="handleCancel()">Cancel</button>
          </div>

          <script>
            async function handleSuccess() {
              // Simulate webhook call
              try {
                await fetch('/api/webhook/mock-stripe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: '${userId}', amount: ${amount} })
                });
                window.location.href = '/api/stripe/callback?status=success';
              } catch (e) {
                alert('Mock payment failed');
              }
            }
            function handleCancel() {
              window.location.href = '/api/stripe/callback?status=cancel';
            }
          </script>
        </body>
      </html>
    `);
  });

  // Mock Webhook (only for mock mode)
  app.post('/api/webhook/mock-stripe', async (req, res) => {
    const { userId, amount } = req.body;
    if (userId && amount > 0) {
      try {
        await db.runTransaction(async (t) => {
          const userRef = db.collection('users').doc(userId);
          const userDoc = await t.get(userRef);
          
          if (userDoc.exists) {
            const currentBalance = userDoc.data()?.balance || 0;
            const newBalance = currentBalance + Number(amount);

            t.update(userRef, { balance: newBalance });
            
            const txRef = userRef.collection('transactions').doc();
            t.set(txRef, {
              type: 'DEPOSIT',
              amount: Number(amount),
              method: 'STRIPE (MOCK)',
              details: JSON.stringify({ mock: true }),
              status: 'COMPLETED',
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        });
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: 'Database error' });
      }
    } else {
      res.status(400).json({ error: 'Invalid data' });
    }
  });

  // Auth Middleware
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    try {
      // Verify Firebase ID Token
      const decodedToken = await admin.auth().verifyIdToken(token);
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (!userDoc.exists) return res.sendStatus(404);
      
      req.user = { ...userDoc.data(), id: decodedToken.uid };
      next();
    } catch (err) {
      console.error('Auth error:', err);
      return res.sendStatus(403);
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Admin access required' });
    }
  };

  // --- API Routes ---
  app.get('/api/config', (req, res) => {
    res.json({
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      gmailConfigured: !!process.env.GMAIL_USER && !!process.env.GMAIL_PASS && process.env.GMAIL_USER !== 'your-email@gmail.com'
    });
  });

  // --- API Routes ---
  app.get('/api/config', (req, res) => {
    res.json({
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      gmailConfigured: !!process.env.GMAIL_USER && !!process.env.GMAIL_PASS && process.env.GMAIL_USER !== 'your-email@gmail.com'
    });
  });

  // User Data
  app.get('/api/user/me', authenticateToken, (req: any, res) => {
    res.json(req.user);
  });

  app.post('/api/user/deposit/initiate', authenticateToken, async (req: any, res) => {
    const { amount } = req.body;
    const userId = req.user.id;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    try {
      const txRef = await db.collection('users').doc(userId).collection('transactions').add({
        type: 'DEPOSIT',
        amount: amount,
        method: 'BANK_TRANSFER',
        status: 'PENDING_PROOF',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ 
        message: 'Deposit initiated. Please submit proof of payment.',
        transactionId: txRef.id 
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to initiate deposit' });
    }
  });

  app.post('/api/user/deposit/submit-proof', authenticateToken, async (req: any, res) => {
    const { transactionId, utrNumber, proofImage } = req.body;
    const userId = req.user.id;

    if (!utrNumber || !proofImage) {
      return res.status(400).json({ error: 'UTR number and proof image are required' });
    }

    try {
      const txRef = db.collection('users').doc(userId).collection('transactions').doc(transactionId);
      const tx = await txRef.get();
      
      if (!tx.exists || tx.data()?.status !== 'PENDING_PROOF') {
        return res.status(404).json({ error: 'Pending transaction not found' });
      }

      await txRef.update({
        status: 'PROCESSING',
        utrNumber,
        proofImage
      });

      res.json({ message: 'Proof submitted. Your deposit is being processed.' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to submit proof' });
    }
  });

  // Admin Routes
  app.get('/api/admin/deposits', authenticateToken, isAdmin, async (req, res) => {
    try {
      const users = await db.collection('users').get();
      let allDeposits: any[] = [];
      
      for (const userDoc of users.docs) {
        const txs = await userDoc.ref.collection('transactions')
          .where('type', '==', 'DEPOSIT')
          .where('status', '==', 'PROCESSING')
          .get();
        
        txs.forEach(tx => {
          allDeposits.push({ ...tx.data(), id: tx.id, userId: userDoc.id, email: userDoc.data().email });
        });
      }
      
      res.json(allDeposits);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch deposits' });
    }
  });

  app.post('/api/admin/deposits/:userId/:id/approve', authenticateToken, isAdmin, async (req, res) => {
    const { userId, id } = req.params;
    
    try {
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(userId);
        const txRef = userRef.collection('transactions').doc(id);
        
        const userDoc = await t.get(userRef);
        const txDoc = await t.get(txRef);
        
        if (!txDoc.exists || txDoc.data()?.status !== 'PROCESSING') {
          throw new Error('Transaction not found or already processed');
        }

        const currentBalance = userDoc.data()?.balance || 0;
        const depositAmount = txDoc.data()?.amount || 0;

        t.update(userRef, { balance: currentBalance + depositAmount });
        t.update(txRef, { status: 'COMPLETED' });
      });
      
      res.json({ message: 'Deposit approved successfully' });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/admin/deposits/:userId/:id/reject', authenticateToken, isAdmin, async (req, res) => {
    const { userId, id } = req.params;
    try {
      await db.collection('users').doc(userId).collection('transactions').doc(id).update({
        status: 'REJECTED'
      });
      res.json({ message: 'Deposit rejected' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to reject deposit' });
    }
  });

  app.get('/api/admin/withdrawals', authenticateToken, isAdmin, async (req, res) => {
    try {
      const users = await db.collection('users').get();
      let allWithdrawals: any[] = [];
      
      for (const userDoc of users.docs) {
        const txs = await userDoc.ref.collection('transactions')
          .where('type', '==', 'WITHDRAWAL')
          .where('status', '==', 'PROCESSING')
          .get();
        
        txs.forEach(tx => {
          allWithdrawals.push({ ...tx.data(), id: tx.id, userId: userDoc.id, email: userDoc.data().email });
        });
      }
      
      res.json(allWithdrawals);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch withdrawals' });
    }
  });

  app.post('/api/admin/withdrawals/:userId/:id/approve', authenticateToken, isAdmin, async (req, res) => {
    const { userId, id } = req.params;
    try {
      await db.collection('users').doc(userId).collection('transactions').doc(id).update({
        status: 'COMPLETED'
      });
      res.json({ message: 'Withdrawal marked as completed' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to approve withdrawal' });
    }
  });

  app.post('/api/admin/withdrawals/:userId/:id/reject', authenticateToken, isAdmin, async (req, res) => {
    const { userId, id } = req.params;
    
    try {
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(userId);
        const txRef = userRef.collection('transactions').doc(id);
        
        const userDoc = await t.get(userRef);
        const txDoc = await t.get(txRef);
        
        if (!txDoc.exists || txDoc.data()?.status !== 'PROCESSING') {
          throw new Error('Withdrawal not found or already processed');
        }

        const currentBalance = userDoc.data()?.balance || 0;
        const withdrawalAmount = Math.abs(txDoc.data()?.amount || 0);

        t.update(userRef, { balance: currentBalance + withdrawalAmount });
        t.update(txRef, { status: 'REJECTED' });
      });
      res.json({ message: 'Withdrawal rejected and refunded' });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
      const users = await db.collection('users').orderBy('balance', 'desc').get();
      res.json(users.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/admin/users/:id/balance', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { balance } = req.body;
    
    if (typeof balance !== 'number') return res.status(400).json({ error: 'Invalid balance' });

    try {
      await db.collection('users').doc(id).update({ balance });
      res.json({ message: 'User balance updated successfully' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update balance' });
    }
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
      const appUrl = process.env.APP_URL || 'http://localhost:3000';

      if (!stripe) {
        // Mock Flow
        console.log(`Using Mock Stripe flow for user ${userEmail}`);
        const mockUrl = `${appUrl}/api/stripe/mock-checkout?amount=${amount}&email=${userEmail}&userId=${userId}`;
        return res.json({ url: mockUrl, isMock: true });
      }

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
        success_url: `${appUrl}/api/stripe/callback?status=success`,
        cancel_url: `${appUrl}/api/stripe/callback?status=cancel`,
        customer_email: userEmail,
        metadata: {
          userId: userId,
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create payment session' });
    }
  });

  app.post('/api/user/deposit/confirm', authenticateToken, async (req: any, res) => {
    const { transactionId } = req.body;
    const userId = req.user.id;

    try {
      const txRef = db.collection('users').doc(userId).collection('transactions').doc(transactionId);
      const txDoc = await txRef.get();
      
      if (!txDoc.exists) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const txData = txDoc.data();
      if (txData?.status === 'COMPLETED') {
        return res.json({ message: 'Already completed', balance: (await db.collection('users').doc(userId).get()).data()?.balance });
      }

      if (txData?.status !== 'PENDING' && txData?.status !== 'PROCESSING') {
        return res.status(400).json({ error: 'Transaction cannot be confirmed in current state' });
      }

      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await t.get(userRef);
        
        const currentBalance = userDoc.data()?.balance || 0;
        const amount = txData?.amount || 0;

        t.update(userRef, { balance: currentBalance + amount });
        t.update(txRef, { 
          status: 'COMPLETED',
          confirmedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      const updatedUser = await db.collection('users').doc(userId).get();
      res.json({ message: 'Deposit confirmed', balance: updatedUser.data()?.balance });
    } catch (e: any) {
      console.error('Confirm deposit error:', e);
      res.status(500).json({ error: e.message || 'Failed to confirm deposit' });
    }
  });

  app.post('/api/user/withdraw', authenticateToken, async (req: any, res) => {
    const { amount, method, details } = req.body;
    const userId = req.user.id;
    
    if (!amount || amount < 5 || amount > 500) {
      return res.status(400).json({ error: 'Withdrawal amount must be between $5 and $500' });
    }
    if (!method || !details) return res.status(400).json({ error: 'Withdrawal method and details are required' });

    try {
      let newBalance = 0;
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await t.get(userRef);
        const currentBalance = userDoc.data()?.balance || 0;

        if (currentBalance < amount) {
          throw new Error('Insufficient balance');
        }

        newBalance = currentBalance - amount;
        t.update(userRef, { balance: newBalance });
        
        const txRef = userRef.collection('transactions').doc();
        t.set(txRef, {
          type: 'WITHDRAWAL',
          amount: -amount,
          method,
          details: JSON.stringify(details),
          status: 'PROCESSING',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      res.json({ balance: newBalance });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Linked Accounts ---
  app.get('/api/user/linked-accounts', authenticateToken, async (req: any, res) => {
    try {
      const accounts = await db.collection('users').doc(req.user.id).collection('linked_accounts').get();
      res.json(accounts.docs.map(doc => ({ ...doc.data(), id: doc.id, details: JSON.parse(doc.data().details || '{}') })));
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch linked accounts' });
    }
  });

  app.post('/api/user/link-account', authenticateToken, async (req: any, res) => {
    const { type, accountName, accountNumber, details } = req.body;
    if (!type || !accountName || !accountNumber) return res.status(400).json({ error: 'Missing fields' });

    try {
      const accountRef = await db.collection('users').doc(req.user.id).collection('linked_accounts').add({
        type,
        accountName,
        accountNumber,
        details: JSON.stringify(details || {}),
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ id: accountRef.id, message: 'Account linked successfully' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to link account' });
    }
  });

  app.delete('/api/user/unlink-account/:id', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    try {
      await db.collection('users').doc(req.user.id).collection('linked_accounts').doc(id).delete();
      res.json({ message: 'Account unlinked successfully' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to unlink account' });
    }
  });

  // Game Logic
  app.post('/api/game/bet', authenticateToken, async (req: any, res) => {
    const { asset, amount } = req.body;
    const userId = req.user.id;

    try {
      let result: any = null;
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await t.get(userRef);
        const userData = userDoc.data();
        
        if (!userData || userData.balance < amount) {
          throw new Error('Insufficient balance');
        }

        // Simulate Race with a random walk (10 steps)
        const steps = 10;
        const btcPath = [0];
        const ethPath = [0];
        let btcPos = 0;
        let ethPos = 0;

        for (let i = 0; i < steps; i++) {
          btcPos += Math.random() * 15;
          ethPos += Math.random() * 15;
          btcPath.push(btcPos);
          ethPath.push(ethPos);
        }

        const winner = btcPos > ethPos ? 'BTC' : 'ETH';
        const won = asset === winner;

        let profit = 0;
        let newBalance = userData.balance;

        if (won) {
          profit = amount * 0.8;
          newBalance += profit;
        } else {
          // First loss refund logic
          if (userData.is_new_user) {
            profit = 0;
            t.update(userRef, { is_new_user: false });
          } else {
            profit = -amount;
            newBalance -= amount;
          }
        }

        t.update(userRef, { balance: newBalance });
        
        const betRef = userRef.collection('bets').doc();
        const betData = {
          asset,
          amount,
          outcome: won ? 'WIN' : 'LOSS',
          profit,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
        t.set(betRef, betData);

        result = {
          winner,
          won,
          profit,
          newBalance,
          refunded: !won && userData.is_new_user,
          paths: { BTC: btcPath, ETH: ethPath }
        };

        // Broadcast live activity
        broadcast({
          type: 'LIVE_ACTIVITY',
          data: {
            email: userData.email.split('@')[0] + '***',
            asset,
            amount,
            outcome: won ? 'WIN' : 'LOSS',
            profit,
            timestamp: new Date().toISOString()
          }
        });
      });

      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/game/history', async (req: any, res) => {
    try {
      const history = await db.collection('global_history').orderBy('timestamp', 'desc').limit(10).get();
      res.json(history.docs.map(doc => doc.data()));
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  });

  app.get('/api/game/leaderboard', async (req, res) => {
    try {
      const leaderboard = await db.collection('users').orderBy('balance', 'desc').limit(5).get();
      res.json(leaderboard.docs.map(doc => ({
        email: doc.data().email.split('@')[0] + '***',
        balance: doc.data().balance
      })));
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // Stripe Callback
  app.get('/api/stripe/callback', (req, res) => {
    const { status } = req.query;
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'STRIPE_PAYMENT_RESULT', status: '${status}' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  });

  // Mock Stripe Checkout
  app.get('/api/stripe/mock-checkout', (req, res) => {
    const { amount, email, userId } = req.query;
    res.send(`
      <html>
        <head>
          <title>Mock Stripe Checkout</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f4f4f4; }
            .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
            button { background: #6772e5; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 16px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Mock Stripe Checkout</h2>
            <p>User: ${email}</p>
            <p>Amount: $${amount}</p>
            <form action="/api/stripe/mock-success" method="POST">
              <input type="hidden" name="userId" value="${userId}">
              <input type="hidden" name="amount" value="${amount}">
              <button type="submit">Pay Now (Simulated)</button>
            </form>
          </div>
        </body>
      </html>
    `);
  });

  app.post('/api/stripe/mock-success', async (req, res) => {
    const { userId, amount } = req.body;
    try {
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await t.get(userRef);
        const currentBalance = userDoc.data()?.balance || 0;
        t.update(userRef, { balance: currentBalance + parseFloat(amount) });
        
        const txRef = userRef.collection('transactions').doc();
        t.set(txRef, {
          type: 'DEPOSIT',
          amount: parseFloat(amount),
          method: 'STRIPE_MOCK',
          status: 'COMPLETED',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      res.redirect('/api/stripe/callback?status=success');
    } catch (e) {
      res.redirect('/api/stripe/callback?status=error');
    }
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
