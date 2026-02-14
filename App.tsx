
import React, { useState, useEffect } from 'react';
import { AuthPage } from './src/pages/AuthPage';
import { LandingPage } from './src/pages/LandingPage';
import { Dashboard } from './src/pages/Dashboard';
import { SettingsPage } from './src/pages/SettingsPage';
import UploadPage from './src/pages/UploadPage';
import CurriculumPage from './src/pages/CurriculumPage';
import { Header } from './src/components/common/Header';
import { Footer } from './src/components/common/Footer';
import { auth } from './src/firebase';
import { CurriculumItem } from './src/types';

export default function App() {
  const [view, setView] = useState<'landing' | 'auth' | 'dashboard' | 'settings' | 'upload' | 'curriculum'>('landing');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Lifted state for curriculum items
  const [curriculumItems, setCurriculumItems] = useState<CurriculumItem[]>([
    {
      id: '1',
      fileName: 'Molecular_Biology_Unit_3.pdf',
      subject: 'Biochemistry',
      topic: 'DNA Replication',
      date: '2024-03-10',
      status: 'Active',
      chapters: [
        { id: '1', title: 'Helicase Dynamics', concepts: ['ATP Binding', 'Unwinding'], selected: true },
        { id: '2', title: 'Polymerase Proofreading', concepts: ['Exonuclease Activity'], selected: true }
      ]
    },
    {
      id: '2',
      fileName: 'Immunology_Lecture_Notes.docx',
      subject: 'Immunology',
      topic: 'Adaptive Response',
      date: '2024-03-08',
      status: 'Inactive',
      chapters: [
        { id: '1', title: 'T-Cell Maturation', concepts: ['Thymic Selection'], selected: false }
      ]
    }
  ]);

  // Authentication listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    setView('landing');
  };

  const handleUploadComplete = (newItem: CurriculumItem) => {
    setCurriculumItems(prev => [newItem, ...prev]);
    setView('curriculum');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  let safeView = view;
  if (!user && (view === 'dashboard' || view === 'settings' || view === 'upload' || view === 'curriculum')) {
    safeView = 'landing';
  } else if (user && (view === 'auth')) {
    safeView = 'dashboard';
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {safeView !== 'auth' && (
        <Header
          onLoginClick={() => setView('auth')}
          onSignupClick={() => setView('auth')}
          userEmail={user?.email}
          onLogout={handleLogout}
          currentView={safeView}
          setView={setView}
          user={user}
        />
      )}

      <main>
        {safeView === 'landing' && <LandingPage onSignupClick={() => setView('auth')} />}

        {safeView === 'auth' && (
          <AuthPage
            initialMode={'login'}
            onBack={() => setView('landing')}
          />
        )}

        {/* Protected Routes */}
        {safeView === 'dashboard' && <Dashboard setView={setView} />}
        {safeView === 'settings' && user && <SettingsPage onLogout={handleLogout} user={user} />}
        {safeView === 'upload' && user && <UploadPage onComplete={handleUploadComplete} />}
        {safeView === 'curriculum' && user && <CurriculumPage items={curriculumItems} />}

      </main>

      {safeView !== 'auth' && <Footer />}

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