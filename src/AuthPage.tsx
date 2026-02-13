// src/AuthPage.tsx
import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  fetchSignInMethodsForEmail 
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { Shield, Mail, Lock, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

interface AuthPageProps {
  initialMode: 'login' | 'signup';
  onBack: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode, onBack }) => {
  const [mode,SJ] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle Email/Password Auth
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        awaitHV(createUserWithEmailAndPassword(auth, email, password));
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      // Custom error messages
      if (err.code === 'auth/invalid-credential') {
        setError("Account does not exist or invalid password.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("That email is already in use. Try logging in.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Auth with "Account Existence" Check
  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Note: Standard Google Sign-in creates an account automatically.
      // If you STRICTLY want to fail if the account didn't exist before, 
      // you would check user.metadata.creationTime === user.metadata.lastSignInTime
      // immediately after login and delete the user if it was a new creation 
      // during a "login" attempt.
      
      if (mode === 'login') {
         // Check if this is a new user (created just now)
         const isNewUser = user.metadata.creationTime === user.metadata.lastSignInTime;
         if (isNewUser) {
           // If we want to strictly enforce "Login only", we act as if it failed
           // Note: In a real production app, we might delete the user here to revert
           await user.delete(); 
           throw new Error("Account does not exist. Please Sign Up first.");
         }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md bg-black/80 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
        <button onClick={onBack} className="text-gray-500 hover:text-white mb-6 flex items-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-amber-500 flex items-center justify-center rounded-sm mx-auto mb-4">
            <Shield className="w-7 h-7 text-black" fill="currentColor" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight mb-2">
            {mode === 'login' ? 'Welcome Back' : 'Start Mastering'}
          </h2>
          <p className="text-gray-400 text-sm">
            {mode === 'login' ? 'Enter your credentials to access your workspace.' : 'Create an account to begin your journey.'}
          </p>
        </div>

        {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex items-start gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
            </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</label>
                <div className="relative">
                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                        placeholder="name@example.com"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                    <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
        </form>

        <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-black px-4 text-gray-500">Or continue with</span></div>
        </div>

        <button 
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-3.5 rounded-lg transition-all flex items-center justify-center gap-3"
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
            Google
        </button>

        <p className="mt-8 text-center text-sm text-gray-400">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button 
                onClick={() => {
                    setError('');
                    setMode(mode === 'login' ? 'signup' : 'login');
                }}
                className="text-amber-500 hover:text-amber-400 font-bold ml-1 hover:underline"
            >
                {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
        </p>
      </div>
    </div>
  );
};