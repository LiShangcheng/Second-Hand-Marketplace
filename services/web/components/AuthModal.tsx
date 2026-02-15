import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import { AuthState } from '../types';

interface AuthModalProps {
  auth: AuthState;
  onClose: () => void;
  onLogin: (payload: { email: string; password: string; name: string }) => Promise<void>;
  onChangeMode: (mode: 'login' | 'register') => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ auth, onClose, onLogin, onChangeMode }) => {
  if (!auth.isOpen) return null;

  const isLogin = auth.mode === 'login';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError(null);
  }, [auth.mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!isLogin && password !== confirmPassword) {
        setError('Passwords do not match.');
        setSubmitting(false);
        return;
      }
      const fallbackName = email.includes('@') ? email.split('@')[0] : 'NYU Student';
      const displayName = name.trim() || fallbackName;
      await onLogin({
        email: email.trim(),
        password,
        name: displayName,
      });
      onClose();
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[480px] overflow-hidden relative flex flex-col">
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-5 right-5 p-2 bg-white/50 hover:bg-gray-100 rounded-full transition-colors z-10 text-gray-500">
            <X size={20} />
        </button>

        {/* Decorative Header */}
        <div className="bg-[#57068c] pt-12 pb-16 px-8 text-center relative overflow-hidden">
             {/* Abstract Circles */}
            <div className="absolute top-[-20%] left-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-40 h-40 bg-purple-500/30 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
                <div className="bg-white/10 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 backdrop-blur-sm shadow-inner border border-white/20">
                     <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    </svg>
                </div>
                <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">{isLogin ? 'Welcome Back!' : 'Join NYU Swap'}</h2>
                <p className="text-purple-100 font-medium opacity-90">
                    {isLogin ? 'Enter your details to sign in' : 'The best marketplace for NYU students'}
                </p>
            </div>
        </div>

        {/* Form Container */}
        <div className="px-8 pb-10 pt-8 -mt-6 bg-white rounded-t-[2rem] relative z-20">
            <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 ml-1 uppercase tracking-wider">Full Name</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <UserIcon size={20} className="text-gray-400" />
                            </div>
                            <input 
                                type="text" 
                                placeholder="e.g. Alex Kim" 
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none transition-all font-medium text-gray-800 placeholder-gray-400" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required 
                            />
                        </div>
                    </div>
                )}
                
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 ml-1 uppercase tracking-wider">Email Address</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Mail size={20} className="text-gray-400" />
                        </div>
                        <input 
                            type="email" 
                            placeholder="netid@nyu.edu" 
                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none transition-all font-medium text-gray-800 placeholder-gray-400" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required 
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 ml-1 uppercase tracking-wider">Password</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Lock size={20} className="text-gray-400" />
                        </div>
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none transition-all font-medium text-gray-800 placeholder-gray-400" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required 
                        />
                    </div>
                    {isLogin && (
                        <div className="flex justify-end pt-1">
                            <a href="#" className="text-xs font-semibold text-[#57068c] hover:underline">Forgot password?</a>
                        </div>
                    )}
                </div>
                {!isLogin && (
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 ml-1 uppercase tracking-wider">Confirm Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock size={20} className="text-gray-400" />
                            </div>
                            <input 
                                type="password" 
                                placeholder="••••••••" 
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none transition-all font-medium text-gray-800 placeholder-gray-400" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required 
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 mt-4 text-lg ${
                        submitting ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#57068c] text-white hover:bg-[#450470]'
                    }`}
                >
                    {isLogin ? 'Log In' : 'Create Account'}
                    <ArrowRight size={20} />
                </button>
            </form>

            <div className="mt-8 text-center">
                <p className="text-gray-500 font-medium">
                    {isLogin ? "New to the community? " : "Already have an account? "}
                    <button 
                        onClick={() => onChangeMode(isLogin ? 'register' : 'login')}
                        className="text-[#57068c] font-bold hover:underline"
                    >
                        {isLogin ? 'Sign Up' : 'Log In'}
                    </button>
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
