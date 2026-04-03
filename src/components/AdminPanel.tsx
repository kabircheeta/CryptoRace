import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, CheckCircle2, XCircle, Clock, RefreshCw, Eye, ExternalLink, ShieldCheck, Users, Edit3, Save } from 'lucide-react';
import { GlassCard, Button, cn } from './ui';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  token: string | null;
  user: any;
  formatCurrency: (amount: number) => string;
}

export default function AdminPanel({ token, user, formatCurrency }: AdminPanelProps) {
  const [adminDeposits, setAdminDeposits] = useState<any[]>([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'users'>('deposits');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editBalance, setEditBalance] = useState<string>('');
  const navigate = useNavigate();

  const fetchAdminData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [depRes, withRes, userRes] = await Promise.all([
        fetch('/api/admin/deposits', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/withdrawals', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (depRes.ok) setAdminDeposits(await depRes.json());
      if (withRes.ok) setAdminWithdrawals(await withRes.json());
      if (userRes.ok) setAdminUsers(await userRes.json());
    } catch (e) {
      console.error("Failed to fetch admin data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchAdminData();
  }, [user, token, navigate]);

  const handleUpdateBalance = async (userId: number) => {
    const balance = parseFloat(editBalance);
    if (isNaN(balance)) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/balance`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ balance })
      });
      
      if (res.ok) {
        setEditingUserId(null);
        fetchAdminData();
      } else {
        const data = await res.json();
        alert(data.error || "Update failed");
      }
    } catch (e) {
      alert("Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAction = async (userId: string, id: string, action: 'approve' | 'reject', type: 'deposit' | 'withdrawal') => {
    setLoading(true);
    try {
      const endpoint = type === 'deposit' 
        ? `/api/admin/deposits/${userId}/${id}/${action}`
        : `/api/admin/withdrawals/${userId}/${id}/${action}`;
        
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchAdminData();
      } else {
        const data = await res.json();
        alert(data.error || "Action failed");
      }
    } catch (e) {
      alert("Admin action failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#E4E3E0] flex flex-col font-sans selection:bg-blue-500/30">
      {/* Top Navigation Bar */}
      <header className="border-b border-white/5 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/')} 
              className="group flex items-center gap-2 text-white/40 hover:text-white transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all">
                <ArrowLeft size={16} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Dashboard</span>
            </button>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-blue-400" />
              <h1 className="font-black text-lg tracking-tighter text-white">ADMIN_CONSOLE_V2</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Operator</span>
              <span className="text-xs font-mono text-blue-400 font-bold">{user?.email}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-blue-400 font-black text-xs">A</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <GlassCard className="p-4 border-l-2 border-l-blue-500">
            <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-1">Pending Deposits</div>
            <div className="text-2xl font-black font-mono">{adminDeposits.length}</div>
          </GlassCard>
          <GlassCard className="p-4 border-l-2 border-l-orange-500">
            <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-1">Pending Withdrawals</div>
            <div className="text-2xl font-black font-mono">{adminWithdrawals.length}</div>
          </GlassCard>
          <GlassCard className="p-4 border-l-2 border-l-emerald-500">
            <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-1">Total Users</div>
            <div className="text-2xl font-black font-mono">{adminUsers.length}</div>
          </GlassCard>
          <GlassCard className="p-4 border-l-2 border-l-white/20">
            <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-1">Last Sync</div>
            <div className="text-xs font-mono text-white/60">{new Date().toLocaleTimeString()}</div>
          </GlassCard>
        </div>

        {/* Tabs & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setActiveTab('deposits')}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-widest",
                activeTab === 'deposits' ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/60"
              )}
            >
              Deposits
            </button>
            <button 
              onClick={() => setActiveTab('withdrawals')}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-widest",
                activeTab === 'withdrawals' ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/60"
              )}
            >
              Withdrawals
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-widest",
                activeTab === 'users' ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/60"
              )}
            >
              Users
            </button>
          </div>
          
          <Button 
            onClick={fetchAdminData} 
            variant="outline" 
            className="w-full sm:w-auto h-10 px-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
            loading={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh Data
          </Button>
        </div>

        {/* Data Grid */}
        <div className="space-y-4">
          {activeTab === 'deposits' ? (
            adminDeposits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                <Clock size={48} className="text-white/10 mb-4" />
                <p className="text-white/20 font-bold uppercase tracking-widest text-sm italic">No pending deposits in queue</p>
              </div>
            ) : (
              adminDeposits.map((deposit) => (
                <GlassCard key={deposit.id} className="p-0 overflow-hidden border-white/5 hover:border-white/10 transition-all group">
                  <div className="grid grid-cols-1 lg:grid-cols-12">
                    {/* Info Section */}
                    <div className="lg:col-span-7 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <Wallet size={20} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white/40 uppercase tracking-widest">User Account</div>
                            <div className="text-sm font-mono font-bold text-white">{deposit.email}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Timestamp</div>
                          <div className="text-xs font-mono text-white/60">{new Date(deposit.timestamp).toLocaleString()}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
                        <div>
                          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Amount Requested</div>
                          <div className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                            {formatCurrency(deposit.amount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">UTR / Ref Number</div>
                          <div className="text-lg font-mono font-bold text-blue-400 select-all">
                            {deposit.utr_number || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Proof Section */}
                    <div className="lg:col-span-2 bg-white/[0.03] border-x border-white/5 p-4 flex flex-col items-center justify-center gap-3">
                      <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Proof of Payment</div>
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black/40 border border-white/10 group/img">
                        {deposit.proof_image ? (
                          <>
                            <img 
                              src={deposit.proof_image} 
                              alt="Proof" 
                              className="w-full h-full object-cover opacity-60 group-hover/img:opacity-100 transition-all cursor-zoom-in"
                              onClick={() => setSelectedImage(deposit.proof_image)}
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 pointer-events-none transition-all">
                              <Eye size={24} className="text-white drop-shadow-lg" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center italic text-white/10 text-[10px]">No Image</div>
                        )}
                      </div>
                    </div>

                    {/* Actions Section */}
                    <div className="lg:col-span-3 p-6 bg-white/[0.01] flex flex-col justify-center gap-3">
                      <Button 
                        onClick={() => handleAdminAction(deposit.userId, deposit.id, 'approve', 'deposit')} 
                        loading={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 h-12 text-xs font-black tracking-widest"
                      >
                        <CheckCircle2 size={16} className="mr-2" />
                        APPROVE DEPOSIT
                      </Button>
                      <Button 
                        onClick={() => handleAdminAction(deposit.userId, deposit.id, 'reject', 'deposit')} 
                        loading={loading}
                        variant="danger"
                        className="w-full h-12 text-xs font-black tracking-widest"
                      >
                        <XCircle size={16} className="mr-2" />
                        REJECT TRANSACTION
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              ))
            )
          ) : activeTab === 'withdrawals' ? (
            adminWithdrawals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                <Clock size={48} className="text-white/10 mb-4" />
                <p className="text-white/20 font-bold uppercase tracking-widest text-sm italic">No pending withdrawals in queue</p>
              </div>
            ) : (
              adminWithdrawals.map((withdrawal) => (
                <GlassCard key={withdrawal.id} className="p-0 overflow-hidden border-white/5 hover:border-white/10 transition-all group">
                  <div className="grid grid-cols-1 lg:grid-cols-12">
                    {/* Info Section */}
                    <div className="lg:col-span-9 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                            <Wallet size={20} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white/40 uppercase tracking-widest">User Account</div>
                            <div className="text-sm font-mono font-bold text-white">{withdrawal.email}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Timestamp</div>
                          <div className="text-xs font-mono text-white/60">{new Date(withdrawal.timestamp).toLocaleString()}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-white/5">
                        <div>
                          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Amount to Send</div>
                          <div className="text-3xl font-black text-orange-400 font-mono tracking-tighter">
                            {formatCurrency(Math.abs(withdrawal.amount))}
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Payout Details ({withdrawal.method})</div>
                          <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs font-mono text-white/80 whitespace-pre-wrap break-all">
                            {(() => {
                              try {
                                const details = JSON.parse(withdrawal.details);
                                return Object.entries(details).map(([k, v]) => `${k}: ${v}`).join('\n');
                              } catch (e) {
                                return withdrawal.details;
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions Section */}
                    <div className="lg:col-span-3 p-6 bg-white/[0.01] flex flex-col justify-center gap-3 border-l border-white/5">
                      <Button 
                        onClick={() => handleAdminAction(withdrawal.userId, withdrawal.id, 'approve', 'withdrawal')} 
                        loading={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 h-12 text-xs font-black tracking-widest"
                      >
                        <CheckCircle2 size={16} className="mr-2" />
                        MARK AS PAID
                      </Button>
                      <Button 
                        onClick={() => handleAdminAction(withdrawal.userId, withdrawal.id, 'reject', 'withdrawal')} 
                        loading={loading}
                        variant="danger"
                        className="w-full h-12 text-xs font-black tracking-widest"
                      >
                        <XCircle size={16} className="mr-2" />
                        REJECT WITHDRAWAL
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              ))
            )
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {adminUsers.map((u) => (
                <GlassCard key={u.id} className="p-6 border-white/5 hover:border-white/10 transition-all">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
                        <Users size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{u.email}</span>
                          {u.role === 'admin' && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">Admin</span>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">User ID: {u.id}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Current Balance</div>
                        {editingUserId === u.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              value={editBalance}
                              onChange={(e) => setEditBalance(e.target.value)}
                              className="w-32 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm font-mono text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              autoFocus
                            />
                            <button 
                              onClick={() => handleUpdateBalance(u.id)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                            >
                              <Save size={16} />
                            </button>
                            <button 
                              onClick={() => setEditingUserId(null)}
                              className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-white/60 transition-all"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-emerald-400 font-mono">{formatCurrency(u.balance)}</span>
                            <button 
                              onClick={() => {
                                setEditingUserId(u.id);
                                setEditBalance(u.balance.toString());
                              }}
                              className="p-1.5 rounded-lg bg-white/5 text-white/20 hover:text-white/60 transition-all"
                            >
                              <Edit3 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <div 
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-full max-h-full"
            >
              <img 
                src={selectedImage} 
                alt="Proof Full" 
                className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl border border-white/10 object-contain"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -top-12 right-0 flex items-center gap-4">
                <a 
                  href={selectedImage} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-white/60 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={16} />
                  Open Original
                </a>
                <button className="text-white/60 hover:text-white">
                  <XCircle size={24} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
