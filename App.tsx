
import React, { useState, useEffect } from 'react';
import { AuthPage } from './src/pages/AuthPage';
import { LandingPage } from './src/pages/LandingPage';
import { Dashboard } from './src/pages/Dashboard';
import { Header } from './src/components/common/Header';
import { auth } from './src/firebase';

export default function App() {
  const [view, setView] = useState<'home' | 'login' | 'signup' | 'dashboard'>('home');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        // If user logs in or is already logged in, show dashboard by default
        // unless we want to allow them to browse landing page while logged in.
        // For now, simpler to redirect to dashboard.
        setView('dashboard');
      } else {
        // If logged out, go to home
        setView('home');
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle navigation from Header
  const handleLogout = async () => {
    await auth.signOut();
    setView('home');
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Header is shown on Home and Dashboard, but not on Auth pages */}
      {(view === 'home' || view === 'dashboard') && (
        <Header
          onLoginClick={() => setView('login')}
          onSignupClick={() => setView('signup')}
          userEmail={user?.email}
          onLogout={handleLogout}
          currentView={view}
        />
      )}

      <main>
        {view === 'home' && <LandingPage onSignupClick={() => setView('signup')} />}

        {view === 'dashboard' && user && <Dashboard />}

        {/* If on dashboard but no user (loading state or error), show nothing or loader */}
        {view === 'dashboard' && !user && (
          <div className="h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {(view === 'login' || view === 'signup') && (
          <AuthPage
            initialMode={view === 'login' ? 'login' : 'signup'}
            onBack={() => setView('home')}
          />
        )}
      </main>
    </div>
  );
}