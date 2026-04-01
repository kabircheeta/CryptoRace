import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, ShieldCheck, Zap, Chrome } from 'lucide-react';
import { GlassCard, Button } from './ui';
import { auth, googleProvider, signInWithPopup, db, doc, getDoc, setDoc } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFirebaseLogin = async (user: any) => {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    let userData;

    if (!userDoc.exists()) {
      // Initialize new user in Firestore
      userData = {
        email: user.email,
        balance: 1000,
        role: user.email === 'kabirsahab96@gmail.com' ? 'admin' : 'user',
        is_new_user: true,
        is_verified: user.emailVerified,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', user.uid), userData);
    } else {
      userData = userDoc.data();
    }

    const token = await user.getIdToken();
    onLogin(token, { ...userData, id: user.uid });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }
      await handleFirebaseLogin(userCredential.user);
    } catch (err: any) {
      console.error('Firebase Auth error:', err);
      let message = 'An error occurred. Please try again.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'Email already in use.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handleFirebaseLogin(result.user);
    } catch (err: any) {
      console.error('Google Login error:', err);
      setError('Google login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#E4E3E0] flex items-center justify-center p-4 font-sans selection:bg-blue-500/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/10">
            <Zap size={32} className="text-blue-400 fill-blue-400/20" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white mb-2">CRYPTO_RACE_V2</h1>
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Digital Asset Competition</p>
        </div>

        <GlassCard className="p-8 border-white/10">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mb-8">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${isLogin ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${!isLogin ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-blue-400 transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-white/10"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-blue-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-white/10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs font-bold"
              >
                <ShieldCheck size={16} />
                {error}
              </motion.div>
            )}

            <div className="space-y-3">
              <Button 
                type="submit" 
                loading={loading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 text-xs font-black tracking-widest"
              >
                {isLogin ? 'ACCESS SYSTEM' : 'CREATE ACCOUNT'}
                <ArrowRight size={16} className="ml-2" />
              </Button>

              <Button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black tracking-widest"
              >
                <Chrome size={16} className="mr-2" />
                CONTINUE WITH GOOGLE
              </Button>
            </div>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
              Secured by Firebase Authentication
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
