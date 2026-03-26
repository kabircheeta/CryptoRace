/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Zap, 
  Wallet, 
  User, 
  LogOut, 
  History, 
  Trophy, 
  ArrowRight,
  Bitcoin,
  Coins,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  CircleDollarSign,
  ArrowLeft,
  ArrowDownCircle,
  Banknote
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CanvasRace from './components/CanvasRace';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface UserData {
  id: number;
  email: string;
  balance: number;
}

interface BetHistory {
  id: number;
  asset: string;
  amount: number;
  outcome: string;
  profit: number;
  timestamp: string;
  email: string;
}

interface LeaderboardEntry {
  email: string;
  balance: number;
}

interface LiveActivity {
  email: string;
  asset: string;
  amount: number;
  outcome: 'WIN' | 'LOSS';
  profit: number;
  timestamp: string;
}

// --- Components ---

const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl", className)}>
    {children}
  </div>
);

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-white/10 rounded-lg", className)} />
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  disabled,
  loading
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}) => {
  const variants = {
    primary: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20",
    secondary: "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20",
    outline: "border border-white/20 hover:bg-white/5 text-white",
    ghost: "hover:bg-white/5 text-white/70 hover:text-white",
    danger: "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30"
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "px-6 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
        variants[variant],
        className
      )}
    >
      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : children}
    </button>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'dashboard' | 'deposit' | 'withdraw'>('dashboard');
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<number | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>({});
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);

  // Game State
  const [betAsset, setBetAsset] = useState<'BTC' | 'ETH'>('BTC');
  const [betAmount, setBetAmount] = useState<number>(10);
  const [isRacing, setIsRacing] = useState(false);
  const [raceResult, setRaceResult] = useState<{ winner: string; won: boolean; profit: number; refunded: boolean; amount: number } | null>(null);
  const [history, setHistory] = useState<BetHistory[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [raceProgress, setRaceProgress] = useState({ BTC: 100, ETH: 100 });
  const [depositAmount, setDepositAmount] = useState(100);
  const [withdrawAmount, setWithdrawAmount] = useState(50);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal' | 'crypto' | 'bank'>('card');
  const [raceWinner, setRaceWinner] = useState<'BTC' | 'ETH' | null>(null);
  const [tempResult, setTempResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);

  const [racePaths, setRacePaths] = useState<{ BTC: number[]; ETH: number[] } | null>(null);
  const [liveActivity, setLiveActivity] = useState<LiveActivity[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [prices, setPrices] = useState<{ BTC: number; ETH: number }>({ BTC: 0, ETH: 0 });
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
    { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  ];

  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data.rates && data.rates[currency]) {
          setExchangeRate(data.rates[currency]);
        }
      } catch (e) {
        console.error("Failed to fetch exchange rates", e);
      }
    };
    fetchExchangeRates();
  }, [currency]);

  const formatCurrency = (amount: number) => {
    const converted = amount * exchangeRate;
    return `${currencySymbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const [btcRes, ethRes] = await Promise.all([
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT')
        ]);
        const btcData = await btcRes.json();
        const ethData = await ethRes.json();
        setPrices({
          BTC: parseFloat(btcData.price),
          ETH: parseFloat(ethData.price)
        });
      } catch (e) {
        console.error("Failed to fetch prices", e);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'LIVE_ACTIVITY') {
          setLiveActivity((prev) => [message.data, ...prev].slice(0, 10));
          // Update history as well to keep it live
          setHistory((prev) => {
            const newBet = {
              id: Date.now(), // Temporary ID for client-side
              asset: message.data.asset,
              amount: message.data.amount,
              outcome: message.data.outcome,
              profit: message.data.profit,
              timestamp: message.data.timestamp,
              email: message.data.email
            };
            return [newBet, ...prev].slice(0, 10);
          });
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    };

    return () => socket.close();
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    fetchHistory();
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        setLoading(true);
        try {
          const res = await fetch('/api/auth/guest', { method: 'POST' });
          const data = await res.json();
          if (res.ok) {
            localStorage.setItem('token', data.token);
            setToken(data.token);
            setUser(data.user);
          }
        } catch (e) {
          console.error("Guest login failed", e);
        } finally {
          setLoading(false);
        }
      } else {
        fetchUser();
        fetchLinkedAccounts();
      }
    };
    initAuth();
  }, [token]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'STRIPE_PAYMENT_RESULT') {
        if (event.data.status === 'success') {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#10b981', '#ffffff', '#3b82f6']
          });
          fetchUser();
        } else {
          setError("Payment was cancelled.");
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleStripeDeposit = async () => {
    if (depositAmount < 5) {
      setError("Minimum deposit is $5");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/deposit/stripe-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: depositAmount })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        // Open Stripe in a popup window
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        const stripeWindow = window.open(
          data.url,
          'stripe_checkout',
          `width=${width},height=${height},top=${top},left=${left}`
        );
        
        if (!stripeWindow) {
          setError("Popup blocked! Please allow popups for this site.");
        }
      } else {
        setError(data.error || "Failed to initiate Stripe payment");
      }
    } catch (e: any) {
      console.error("Stripe error:", e);
      setError(e.message || "Stripe deposit failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedAccounts = async () => {
    try {
      const res = await fetch('/api/user/linked-accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLinkedAccounts(data);
      }
    } catch (e) {
      console.error("Failed to fetch linked accounts", e);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/user/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        fetchHistory();
        fetchLeaderboard();
      } else {
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (e) {
      localStorage.removeItem('token');
      setToken(null);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/game/history');
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch('/api/game/leaderboard');
      if (res.ok) setLeaderboard(await res.json());
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!paymentDetails.accountName || !paymentDetails.accountNumber) {
      setError("Please fill in all payment details first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/deposit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          amount: depositAmount, 
          method: paymentMethod,
          details: paymentDetails
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPendingTransaction(data.transactionId);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError("Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeposit = async () => {
    if (!pendingTransaction) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/deposit/confirm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId: pendingTransaction })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(prev => prev ? { ...prev, balance: data.balance } : null);
        setPendingTransaction(null);
        setPaymentDetails({});
        setView('dashboard');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#ffffff']
        });
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError("Confirmation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (withdrawAmount < 5 || withdrawAmount > 500) {
      setError("Withdrawal amount must be between $5 and $500");
      return;
    }
    if (!paymentDetails.accountName || !paymentDetails.accountNumber) {
      setError("Please fill in all withdrawal details first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/withdraw', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          amount: withdrawAmount, 
          method: paymentMethod,
          details: paymentDetails
        })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(prev => prev ? { ...prev, balance: data.balance } : null);
        setPaymentDetails({});
        setView('dashboard');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ef4444', '#ffffff']
        });
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError("Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  const totalWinnings = history.reduce((acc, bet) => acc + (bet.outcome === 'WIN' ? bet.profit : 0), 0);

  const placeBet = async () => {
    if (!user || betAmount > user.balance || isRacing) return;

    setIsRacing(true);
    setRaceResult(null);
    setRaceWinner(null);
    setTempResult(null);
    setRacePaths(null);
    setAnimationFinished(false);
    setShowResultModal(false);

    try {
      const res = await fetch('/api/game/bet', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ asset: betAsset, amount: betAmount })
      });
      const data = await res.json();
      
      if (res.ok) {
        setTempResult({ ...data, amount: betAmount });
        setRaceWinner(data.winner);
        setRacePaths(data.paths);
      } else {
        setIsRacing(false);
        setError(data.error || "Bet failed");
      }
    } catch (e) {
      setIsRacing(false);
      setError("Bet failed");
    }
  };

  const onRaceFinish = () => {
    setAnimationFinished(true);
  };

  useEffect(() => {
    if (animationFinished && tempResult && isRacing) {
      setRaceResult(tempResult);
      setUser(prev => prev ? { ...prev, balance: tempResult.newBalance } : null);
      setIsRacing(false);
      setShowResultModal(true);
      setAnimationFinished(false);
      fetchHistory();
      fetchLeaderboard();

      if (tempResult.won) {
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#ffffff', '#f59e0b']
        });
      }
    }
  }, [animationFinished, tempResult, isRacing]);

  const handleLinkAccount = async () => {
    if (!paymentDetails.accountName || !paymentDetails.accountNumber) {
      setError("Please fill in account details first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/link-account', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: paymentMethod,
          accountName: paymentDetails.accountName,
          accountNumber: paymentDetails.accountNumber,
          details: paymentDetails
        })
      });
      if (res.ok) {
        fetchLinkedAccounts();
        setError(null);
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (e) {
      setError("Failed to link account");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkAccount = async (id: number) => {
    try {
      const res = await fetch(`/api/user/unlink-account/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchLinkedAccounts();
      }
    } catch (e) {
      console.error("Failed to unlink account", e);
    }
  };

  // --- Render Views ---

  if (view === 'withdraw') {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col">
        <header className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
            <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm md:text-base">
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-2 md:gap-3 bg-white/5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-white/10">
              <Wallet size={16} className="text-emerald-400" />
              <span className="font-mono font-bold text-emerald-400 text-sm md:text-base">{formatCurrency(user?.balance || 0)}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-6 py-8 md:py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-4xl font-black mb-2">WITHDRAW FUNDS</h2>
            <p className="text-white/50 mb-12">Withdraw your winnings to your bank account or PayPal. Min: {formatCurrency(5)}, Max: {formatCurrency(500)}.</p>

            <div className="space-y-8">
              {/* Withdrawal Methods */}
              <section>
                <label className="block text-sm font-medium text-white/50 mb-4 uppercase tracking-wider">1. Select Withdrawal Method</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'bank', name: 'Bank Transfer', icon: <Banknote size={24} />, color: 'text-blue-400' },
                    { id: 'paypal', name: 'PayPal', icon: <CircleDollarSign size={24} />, color: 'text-indigo-400' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={cn(
                        "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3",
                        paymentMethod === method.id ? "border-blue-500 bg-blue-500/10" : "border-white/5 bg-white/5 hover:border-white/10"
                      )}
                    >
                      <div className={cn(paymentMethod === method.id ? method.color : "text-white/40")}>
                        {method.icon}
                      </div>
                      <span className="font-bold">{method.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Amount Selection */}
              <section>
                <label className="block text-sm font-medium text-white/50 mb-4 uppercase tracking-wider">2. Withdrawal Amount ($5 - $500)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-8 pr-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                </div>
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              </section>

              {/* Linked Accounts */}
              {linkedAccounts.filter(a => a.type === paymentMethod).length > 0 && (
                <section>
                  <label className="block text-sm font-medium text-white/50 mb-4 uppercase tracking-wider">Linked {paymentMethod.toUpperCase()} Accounts</label>
                  <div className="grid grid-cols-1 gap-3">
                    {linkedAccounts.filter(a => a.type === paymentMethod).map(account => (
                      <div 
                        key={account.id}
                        onClick={() => setPaymentDetails(account.details)}
                        className={cn(
                          "p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer",
                          paymentDetails.accountNumber === account.account_number ? "border-blue-500 bg-blue-500/10" : "border-white/5 bg-white/5 hover:border-white/10"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                            {paymentMethod === 'paypal' && <CircleDollarSign size={18} className="text-indigo-400" />}
                            {paymentMethod === 'bank' && <Banknote size={18} className="text-emerald-400" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{account.account_name}</p>
                            <p className="text-xs text-white/40 font-mono">{account.account_number}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Withdrawal Details */}
              <GlassCard className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-white/50">
                    {linkedAccounts.filter(a => a.type === paymentMethod).length > 0 ? 'Or Use New Details' : 'Details'}
                  </h4>
                  <button 
                    onClick={() => {
                      if (paymentMethod === 'bank') {
                        setPaymentDetails({
                          accountName: user?.email.split('@')[0].toUpperCase(),
                          accountNumber: 'GB12345678901234',
                          swift: 'CHASEGB2L'
                        });
                      } else {
                        setPaymentDetails({
                          accountName: user?.email.split('@')[0],
                          accountNumber: user?.email
                        });
                      }
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <Zap size={12} /> Autofill
                  </button>
                </div>
                {paymentMethod === 'bank' && (
                  <div className="space-y-4">
                    <input 
                      placeholder="Account Holder Name" 
                      value={paymentDetails.accountName || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, accountName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                    />
                    <input 
                      placeholder="IBAN / Account Number" 
                      value={paymentDetails.accountNumber || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, accountNumber: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                    />
                    <input 
                      placeholder="SWIFT / BIC" 
                      value={paymentDetails.swift || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, swift: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                    />
                  </div>
                )}
                {paymentMethod === 'paypal' && (
                  <div className="space-y-4">
                    <input 
                      placeholder="PayPal Email Address" 
                      type="email" 
                      value={paymentDetails.accountNumber || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, accountNumber: e.target.value, accountName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                    />
                  </div>
                )}
              </GlassCard>

              <Button onClick={handleWithdraw} loading={loading} className="w-full py-5 text-xl rounded-2xl" variant="danger">
                CONFIRM WITHDRAWAL
              </Button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }
  if (view === 'deposit') {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col">
        <header className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
            <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm md:text-base">
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-2 md:gap-3 bg-white/5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-white/10">
              <Wallet size={16} className="text-emerald-400" />
              <span className="font-mono font-bold text-emerald-400 text-sm md:text-base">{formatCurrency(user?.balance || 0)}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-6 py-8 md:py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-4xl font-black mb-2">DEPOSIT FUNDS</h2>
            <p className="text-white/50 mb-12">Choose your preferred payment method and amount to top up your account.</p>

            <div className="space-y-8">
              {/* Payment Methods */}
              <section>
                <label className="block text-sm font-medium text-white/50 mb-4 uppercase tracking-wider">1. Select Payment Method</label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { id: 'card', name: 'Credit/Debit', icon: <CreditCard size={24} />, color: 'text-blue-400' },
                    { id: 'paypal', name: 'PayPal', icon: <CircleDollarSign size={24} />, color: 'text-indigo-400' },
                    { id: 'bank', name: 'Bank', icon: <Banknote size={24} />, color: 'text-emerald-400' },
                    { id: 'crypto', name: 'Crypto', icon: <Bitcoin size={24} />, color: 'text-orange-500' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => {
                        setPaymentMethod(method.id as any);
                        setPaymentDetails({});
                        setPendingTransaction(null);
                      }}
                      className={cn(
                        "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3",
                        paymentMethod === method.id ? "border-blue-500 bg-blue-500/10" : "border-white/5 bg-white/5 hover:border-white/10"
                      )}
                    >
                      <div className={cn(paymentMethod === method.id ? method.color : "text-white/40")}>
                        {method.icon}
                      </div>
                      <span className="font-bold text-xs">{method.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Amount Selection */}
              <section>
                <label className="block text-sm font-medium text-white/50 mb-4 uppercase tracking-wider">2. Select Amount</label>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[50, 100, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setDepositAmount(amt)}
                      className={cn(
                        "py-3 rounded-xl border transition-all font-bold",
                        depositAmount === amt ? "bg-blue-600 border-blue-500" : "bg-white/5 border-white/10 hover:bg-white/10"
                      )}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-8 pr-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </section>

              {/* Linked Accounts */}
              {linkedAccounts.filter(a => a.type === paymentMethod).length > 0 && (
                <section>
                  <label className="block text-sm font-medium text-white/50 mb-4 uppercase tracking-wider">Linked {paymentMethod.toUpperCase()} Accounts</label>
                  <div className="grid grid-cols-1 gap-3">
                    {linkedAccounts.filter(a => a.type === paymentMethod).map(account => (
                      <div 
                        key={account.id}
                        onClick={() => setPaymentDetails(account.details)}
                        className={cn(
                          "p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer",
                          paymentDetails.accountNumber === account.account_number ? "border-blue-500 bg-blue-500/10" : "border-white/5 bg-white/5 hover:border-white/10"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                            {paymentMethod === 'card' && <CreditCard size={18} className="text-blue-400" />}
                            {paymentMethod === 'paypal' && <CircleDollarSign size={18} className="text-indigo-400" />}
                            {paymentMethod === 'bank' && <Banknote size={18} className="text-emerald-400" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{account.account_name}</p>
                            <p className="text-xs text-white/40 font-mono">{account.account_number}</p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnlinkAccount(account.id);
                          }}
                          className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors"
                        >
                          <History size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Payment Details Simulation */}
              <GlassCard className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-white/50">
                    {linkedAccounts.filter(a => a.type === paymentMethod).length > 0 ? 'Or Use New Details' : 'Payment Details'}
                  </h4>
                  {!pendingTransaction && (
                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          if (paymentMethod === 'card') {
                            setPaymentDetails({ accountName: 'JOHN DOE', accountNumber: '4242 4242 4242 4242', expiry: '12/28', cvc: '123' });
                          } else if (paymentMethod === 'paypal') {
                            setPaymentDetails({ accountName: user?.email, accountNumber: user?.email });
                          } else if (paymentMethod === 'bank') {
                            setPaymentDetails({ accountName: 'JOHN DOE', accountNumber: 'GB1234567890', swift: 'CHASEGB' });
                          } else {
                            setPaymentDetails({ accountName: 'CRYPTO WALLET', accountNumber: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' });
                          }
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                      >
                        <Zap size={12} /> Autofill
                      </button>
                      {paymentMethod !== 'crypto' && (
                        <button 
                          onClick={handleLinkAccount}
                          disabled={loading}
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                        >
                          <ShieldCheck size={12} /> Link Account
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {paymentMethod === 'card' && (
                  <div className="space-y-4">
                    <input 
                      placeholder="Cardholder Name" 
                      value={paymentDetails.accountName || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, accountName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                    />
                    <input 
                      placeholder="Card Number" 
                      value={paymentDetails.accountNumber || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, accountNumber: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        placeholder="MM/YY" 
                        value={paymentDetails.expiry || ''}
                        onChange={(e) => setPaymentDetails({...paymentDetails, expiry: e.target.value})}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                      />
                      <input 
                        placeholder="CVC" 
                        value={paymentDetails.cvc || ''}
                        onChange={(e) => setPaymentDetails({...paymentDetails, cvc: e.target.value})}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                      />
                    </div>
                  </div>
                )}
                {paymentMethod === 'paypal' && (
                  <div className="space-y-4">
                    <input 
                      placeholder="PayPal Email Address" 
                      type="email" 
                      value={paymentDetails.accountNumber || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, accountNumber: e.target.value, accountName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                    />
                  </div>
                )}
                {paymentMethod === 'bank' && (
                  <div className="space-y-4">
                    <input 
                      placeholder="Account Holder Name" 
                      value={paymentDetails.accountName || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, accountName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                    />
                    <input 
                      placeholder="IBAN / Account Number" 
                      value={paymentDetails.accountNumber || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, accountNumber: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3" 
                    />
                  </div>
                )}
                {paymentMethod === 'crypto' && (
                  <div className="p-4 text-center bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                    <Bitcoin className="mx-auto mb-2 text-orange-500" size={32} />
                    <p className="text-orange-500 text-sm font-medium">Send {formatCurrency(depositAmount)} to the generated BTC address.</p>
                    <code className="block mt-4 p-2 bg-black/50 rounded text-[10px] break-all">bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</code>
                    <input 
                      placeholder="Your Wallet Address (for verification)" 
                      value={paymentDetails.accountNumber || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, accountNumber: e.target.value, accountName: 'CRYPTO'})}
                      className="w-full mt-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm" 
                    />
                  </div>
                )}
              </GlassCard>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              {!pendingTransaction ? (
                <div className="space-y-4">
                  {paymentMethod === 'card' && (
                    <Button 
                      onClick={handleStripeDeposit} 
                      loading={loading} 
                      className="w-full py-5 text-xl rounded-2xl bg-blue-600 hover:bg-blue-500 border-blue-400"
                    >
                      PAY WITH STRIPE
                    </Button>
                  )}
                  <Button onClick={handleDeposit} loading={loading} className="w-full py-5 text-xl rounded-2xl" variant="secondary">
                    {paymentMethod === 'card' ? 'MANUAL DEPOSIT' : 'INITIATE DEPOSIT'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
                    <p className="text-emerald-400 font-bold mb-1">DEPOSIT INITIATED!</p>
                    <p className="text-white/50 text-xs">Please complete the payment on your {paymentMethod} app, then click below.</p>
                  </div>
                  <Button onClick={handleConfirmDeposit} loading={loading} className="w-full py-5 text-xl rounded-2xl bg-emerald-600 hover:bg-emerald-500 border-emerald-400">
                    CONFIRM SUCCESSFUL DEPOSIT
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Zap size={20} className="md:w-6 md:h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg md:text-xl font-bold tracking-tight leading-none">CRYPTO RACE</span>
                <div className="hidden md:flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-[10px] font-mono text-orange-500/80">
                    <Bitcoin size={10} />
                    <span>{prices.BTC > 0 ? formatCurrency(prices.BTC) : '---'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-blue-400/80">
                    <Coins size={10} />
                    <span>{prices.ETH > 0 ? formatCurrency(prices.ETH) : '---'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Balance */}
            <div className="flex md:hidden items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
              <Wallet size={14} className="text-emerald-400" />
              <span className="font-mono font-bold text-emerald-400 text-sm">{formatCurrency(user?.balance || 0)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-6">
            <div className="flex items-center gap-2 flex-1 md:flex-none">
              <select 
                value={currency}
                onChange={(e) => {
                  const selected = currencies.find(c => c.code === e.target.value);
                  if (selected) {
                    setCurrency(selected.code);
                    setCurrencySymbol(selected.symbol);
                  }
                }}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                {currencies.map(c => (
                  <option key={c.code} value={c.code} className="bg-[#050505]">{c.code}</option>
                ))}
              </select>
              <div className="flex items-center gap-1 flex-1 md:flex-none">
                <button 
                  onClick={() => setView('deposit')}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all text-[10px] md:text-sm font-bold"
                >
                  <Zap size={12} className="md:w-3.5 md:h-3.5" /> DEPOSIT
                </button>
                <button 
                  onClick={() => {
                    setPaymentMethod('bank');
                    setView('withdraw');
                  }}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all text-[10px] md:text-sm font-bold"
                >
                  <ArrowDownCircle size={12} className="md:w-3.5 md:h-3.5" /> WITHDRAW
                </button>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              <Wallet size={18} className="text-emerald-400" />
              <span className="font-mono font-bold text-emerald-400">{formatCurrency(user?.balance || 0)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Game Area */}
        <div className="lg:col-span-8 space-y-4 md:space-y-6">
          {/* Race Track Section */}
          <CanvasRace 
            isRacing={isRacing} 
            winner={raceWinner} 
            paths={racePaths}
            onFinish={onRaceFinish} 
            totalWinnings={totalWinnings}
          />

          {/* Betting Controls */}
          <GlassCard className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 p-4 md:p-8">
            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">1. Select Asset</label>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <button 
                    onClick={() => setBetAsset('BTC')}
                    className={cn(
                      "p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                      betAsset === 'BTC' ? "border-orange-500 bg-orange-500/10" : "border-white/5 bg-white/5 hover:border-white/10"
                    )}
                  >
                    <Bitcoin className={betAsset === 'BTC' ? "text-orange-500" : "text-white/40"} size={28} />
                    <div className="text-center">
                      <span className="font-bold block text-xs md:text-sm">BITCOIN</span>
                      <span className="text-[9px] md:text-[10px] text-orange-500/80 font-mono font-bold uppercase tracking-widest">1.8x Odds</span>
                    </div>
                  </button>
                  <button 
                    onClick={() => setBetAsset('ETH')}
                    className={cn(
                      "p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all flex flex-col items-center gap-2 relative overflow-hidden",
                      betAsset === 'ETH' ? "border-blue-500 bg-blue-500/10" : "border-white/5 bg-white/5 hover:border-white/10"
                    )}
                  >
                    <Coins className={betAsset === 'ETH' ? "text-blue-500" : "text-white/40"} size={28} />
                    <div className="text-center">
                      <span className="font-bold block text-xs md:text-sm">ETHEREUM</span>
                      <span className="text-[9px] md:text-[10px] text-blue-400/80 font-mono font-bold uppercase tracking-widest">1.8x Odds</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">2. Bet Amount</label>
                <div className="relative mb-4">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">{currencySymbol}</span>
                  <input 
                    type="number"
                    value={Math.round(betAmount * exchangeRate)}
                    onChange={(e) => setBetAmount(Math.max(1, Math.min(1000, Number(e.target.value) / exchangeRate)))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl pl-8 pr-4 py-3 md:py-4 text-lg md:text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-right">
                    <span className="block text-[9px] md:text-[10px] text-white/30 uppercase font-bold">Potential Win</span>
                    <span className="block text-xs md:text-sm font-mono font-bold text-emerald-400">+{currencySymbol}{(betAmount * 0.8 * exchangeRate).toFixed(2)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 50, 100, 500].map(amt => (
                    <button 
                      key={amt}
                      onClick={() => setBetAmount(amt)}
                      className="py-2 rounded-lg md:rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-[10px] md:text-sm font-bold"
                    >
                      {currencySymbol}{Math.round(amt * exchangeRate)}
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={placeBet}
                disabled={isRacing || !user || betAmount > user.balance}
                className="w-full py-4 md:py-6 text-lg md:text-xl font-black italic tracking-tighter rounded-xl md:rounded-2xl shadow-xl shadow-blue-500/20"
                variant="primary"
              >
                {isRacing ? 'RACING...' : 'PLACE BET'}
              </Button>
            </div>
          </GlassCard>

          {/* Live Activity Section */}
          <GlassCard className="p-0 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-bold uppercase tracking-wider text-sm">Live Global Activity</h3>
              </div>
              <span className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Real-time Feed</span>
            </div>
            <div className="divide-y divide-white/5">
              {liveActivity.length === 0 ? (
                <div className="p-8 text-center text-white/20 text-sm italic">
                  Waiting for live races...
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {liveActivity.map((activity, i) => (
                    <motion.div 
                      key={activity.timestamp + i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          activity.outcome === 'WIN' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        )}>
                          {activity.asset === 'BTC' ? <Bitcoin size={20} /> : <Coins size={20} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold">
                            {activity.email.startsWith('guest_') ? `Guest #${activity.email.split('_')[1].split('@')[0]}` : activity.email}
                          </p>
                          <p className="text-[10px] text-white/40 uppercase tracking-wider">
                            Bet {formatCurrency(activity.amount)} on {activity.asset}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "font-mono font-bold text-sm",
                          activity.outcome === 'WIN' ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {activity.outcome === 'WIN' ? '+' : '-'}{formatCurrency(Math.abs(activity.profit))}
                        </div>
                        <div className="text-[10px] text-white/30">
                          {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Stats & History */}
        <div className="lg:col-span-4 space-y-4 md:space-y-6">
          {/* Leaderboard */}
          <GlassCard className="p-0 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-white/5 flex items-center gap-2">
              <Trophy size={18} className="text-yellow-400 md:w-5 md:h-5" />
              <h3 className="text-sm md:text-base font-bold uppercase tracking-wider">Top Racers</h3>
            </div>
            <div className="divide-y divide-white/5">
              {leaderboardLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-4 h-4" />
                      <Skeleton className="w-20 md:w-24 h-4" />
                    </div>
                    <Skeleton className="w-12 md:w-16 h-4" />
                  </div>
                ))
              ) : (
                leaderboard.map((entry, i) => (
                  <div key={i} className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-white/30 font-mono w-4 text-xs md:text-sm">{i + 1}</span>
                      <span className="text-xs md:text-sm font-medium truncate max-w-[100px] md:max-w-[120px]">
                        {entry.email.startsWith('guest_') ? `Guest #${entry.email.split('_')[1].split('@')[0]}` : entry.email}
                      </span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold text-xs md:text-sm">{formatCurrency(entry.balance)}</span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* History */}
          <GlassCard className="p-0 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-white/5 flex items-center gap-2">
              <History size={18} className="text-blue-400 md:w-5 md:h-5" />
              <h3 className="text-sm md:text-base font-bold uppercase tracking-wider">Recent Bets</h3>
            </div>
            <div className="divide-y divide-white/5 max-h-[300px] md:max-h-[400px] overflow-y-auto">
              {historyLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="w-20 md:w-24 h-4" />
                      <Skeleton className="w-12 md:w-16 h-3" />
                    </div>
                    <div className="text-right space-y-2">
                      <Skeleton className="w-10 md:w-12 h-4 ml-auto" />
                      <Skeleton className="w-12 md:w-16 h-3 ml-auto" />
                    </div>
                  </div>
                ))
              ) : history.length === 0 ? (
                <div className="p-8 md:p-12 text-center text-white/30 text-xs md:text-sm">No bets yet</div>
              ) : (
                history.map((bet) => (
                  <div key={bet.id} className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex flex-col overflow-hidden">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-xs md:text-sm font-bold truncate max-w-[100px] md:max-w-[120px]">
                          {bet.email.startsWith('guest_') ? `Guest #${bet.email.split('_')[1].split('@')[0]}` : bet.email}
                        </span>
                        <span className="text-[8px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded bg-white/5 text-white/40 uppercase tracking-tighter">{bet.asset}</span>
                      </div>
                      <span className="text-[10px] md:text-xs text-white/30">{new Date(bet.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "font-mono font-bold text-xs md:text-sm",
                        bet.outcome === 'WIN' ? "text-emerald-400" : "text-red-400"
                      )}>
                        {bet.outcome === 'WIN' ? '+' : ''}{formatCurrency(bet.profit)}
                      </div>
                      <div className="text-[8px] md:text-[10px] text-white/30 uppercase">Bet: {formatCurrency(bet.amount)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center text-white/20 text-sm border-t border-white/5">
        &copy; 2026 CRYPTO RACE PREDICTION. PLAY RESPONSIBLY.
      </footer>

      {/* Result Modal */}
      <AnimatePresence>
        {showResultModal && raceResult && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm"
            >
              <GlassCard className={cn(
                "p-8 text-center border-2",
                raceResult.won ? "border-emerald-500/50" : "border-rose-500/50"
              )}>
                <div className={cn(
                  "w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center",
                  raceResult.won ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                )}>
                  {raceResult.won ? <Trophy size={40} /> : <AlertCircle size={40} />}
                </div>
                
                <h2 className="text-3xl font-black italic tracking-tighter mb-2">
                  {raceResult.won ? "VICTORY!" : "DEFEAT"}
                </h2>
                
                <p className="text-white/60 mb-8">
                  {raceResult.winner} dominated the track this time.
                </p>

                <div className="bg-white/5 rounded-2xl p-6 mb-8 border border-white/5">
                  <div className="text-xs text-white/40 uppercase tracking-widest mb-1">
                    {raceResult.won ? "Profit Earned" : "Amount Lost"}
                  </div>
                  <div className={cn(
                    "text-4xl font-black",
                    raceResult.won ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {raceResult.won ? `+${formatCurrency(raceResult.profit)}` : `-${formatCurrency(raceResult.amount)}`}
                  </div>
                  {raceResult.refunded && (
                    <div className="mt-2 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                      First Loss Refunded!
                    </div>
                  )}
                </div>

                <Button 
                  onClick={() => setShowResultModal(false)}
                  className="w-full py-4 rounded-xl"
                  variant={raceResult.won ? "secondary" : "primary"}
                >
                  CONTINUE
                </Button>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
