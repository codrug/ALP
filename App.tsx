import React, { useState, useEffect, useCallback } from 'react';
import { AuthPage } from './src/pages/AuthPage';
import { LandingPage } from './src/pages/LandingPage';
import { Dashboard } from './src/pages/Dashboard'; // Updated Component
import { SettingsPage } from './src/pages/SettingsPage';
import UploadPage from './src/pages/UploadPage';
import CurriculumPage from './src/pages/CurriculumPage';
import { QuizView } from './src/pages/QuizView'; // [NEW] Import QuizView
import { Header } from './src/components/common/Header';
import { Footer } from './src/components/common/Footer';
import { auth } from './src/firebase';
import { CurriculumItem } from './src/types';
import { listDocuments } from './src/api';

// [UPDATE] Extended view type to include 'quiz'
type ViewState = 'landing' | 'auth' | 'dashboard' | 'settings' | 'upload' | 'curriculum' | 'quiz';

export default function App() {
  const [view, setView] = useState<ViewState>('landing');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // [NEW] State to track which document is being quizzed
  const [quizDocId, setQuizDocId] = useState<string | null>(null);

  // Curriculum Data State
  const [curriculumItems, setCurriculumItems] = useState<CurriculumItem[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const refreshDocuments = useCallback(async () => {
    try {
      setItemsError(null);
      const items = await listDocuments();
      setCurriculumItems(items as CurriculumItem[]);
    } catch (err: any) {
      setItemsError(err.message || 'Failed to load curriculum.');
      setCurriculumItems([]);
    }
  }, []);

  // Authentication Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auto-refresh docs on login
  useEffect(() => {
    if (user) {
      refreshDocuments();
    }
  }, [user, refreshDocuments]);

  const handleLogout = async () => {
    await auth.signOut();
    setView('landing');
  };

  const handleUploadComplete = async () => {
    await refreshDocuments();
    setView('dashboard'); // Redirect to dashboard after upload
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Route Protection Logic
  let safeView = view;
  if (!user && (view === 'dashboard' || view === 'settings' || view === 'upload' || view === 'curriculum' || view === 'quiz')) {
    safeView = 'landing';
  } else if (user && view === 'landing') {
    safeView = 'dashboard'; // Auto-redirect logged-in users to dashboard
  } else if (user && view === 'auth') {
    safeView = 'dashboard';
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      {/* Header is hidden on Auth and Quiz views for immersion */}
      {safeView !== 'auth' && safeView !== 'quiz' && (
        <Header
          onLoginClick={() => setView('auth')}
          onSignupClick={() => setView('auth')}
          userEmail={user?.email}
          onLogout={handleLogout}
          currentView={safeView}
          setView={(v) => setView(v as ViewState)}
          user={user}
        />
      )}

      <main className="flex-grow">
        {safeView === 'landing' && <LandingPage onSignupClick={() => setView('auth')} />}

        {safeView === 'auth' && (
          <AuthPage
            initialMode={'login'}
            onBack={() => setView('landing')}
          />
        )}

        {/* Protected Routes */}
        {safeView === 'dashboard' && (
          <Dashboard
            setView={(v) => setView(v as ViewState)}
            setQuizDocId={setQuizDocId} // Pass setter to Dashboard
            itemsError={itemsError}
          />
        )}

        {safeView === 'settings' && user && <SettingsPage onLogout={handleLogout} user={user} />}

        {safeView === 'upload' && user && <UploadPage onComplete={handleUploadComplete} />}

        {safeView === 'curriculum' && user && (
          <CurriculumPage
            items={curriculumItems}
            itemsError={itemsError}
            onRefresh={refreshDocuments}
          />
        )}

        {/* [NEW] Quiz View Route */}
        {safeView === 'quiz' && user && (
          <QuizView
            docId={quizDocId}
            setView={(v) => setView(v as ViewState)}
          />
        )}

      </main>

      {/* Footer only on Landing */}
      {safeView === 'landing' && <Footer />}

      {/* Global Animations */}
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
        
        .animate-in {
          animation-duration: 400ms;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          fill-mode: forwards;
        }
        .fade-in {
            animation-name: fade-in;
        }
        .slide-in-from-bottom-4 {
            animation-name: slide-in-from-bottom-4;
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom-4 { from { transform: translateY(1rem); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}