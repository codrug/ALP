import React, { useState } from 'react';
import { Menu, LogOut, LayoutDashboard, User, BookOpen, FileUp } from 'lucide-react';
import { Logo } from './Logo';
import { User as FirebaseUser } from 'firebase/auth';

interface HeaderProps {
    onLoginClick: () => void;
    onSignupClick: () => void;
    userEmail: string | null;
    onLogout: () => void;
    currentView: 'landing' | 'auth' | 'dashboard' | 'settings' | 'upload' | 'curriculum';
    setView: (view: 'landing' | 'auth' | 'dashboard' | 'settings' | 'upload' | 'curriculum') => void;
    user?: FirebaseUser | null;
}

export const Header: React.FC<HeaderProps> = ({
    onLoginClick,
    onSignupClick,
    userEmail,
    onLogout,
    currentView,
    setView,
    user
}) => {
    const [imgError, setImgError] = useState(false);

    const getFirstName = (displayName: string | null) => {
        if (!displayName) return 'Candidate';
        return displayName.split(' ')[0];
    };

    const getInitials = (displayName: string | null) => {
        if (!displayName) return 'C';
        const names = displayName.trim().split(/\s+/);
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return names[0][0].toUpperCase();
    };

    const displayName = user?.displayName || 'Candidate';
    const photoURL = user?.photoURL;
    const initials = getInitials(user?.displayName);

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                <div className="cursor-pointer" onClick={() => setView('landing')}>
                    <Logo size="md" />
                </div>

                <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                    {currentView === 'landing' ? (
                        <>
                            <a href="#" className="hover:text-amber-500 transition-colors">The Standard</a>
                            <a href="#" className="hover:text-amber-500 transition-colors">The Loop</a>
                            <div className="h-4 w-px bg-white/10 mx-2" />
                            <button onClick={onLoginClick} className="hover:text-amber-500 transition-colors">Login</button>
                            <button onClick={onSignupClick} className="bg-amber-500 hover:bg-amber-600 text-black px-5 py-2 rounded-md font-bold text-xs transition-all flex items-center gap-2">
                                Get Started
                            </button>
                        </>
                    ) : (
                        <>
                            {currentView !== 'auth' && (
                                <>
                                    <button
                                        onClick={() => setView('dashboard')}
                                        className={`flex items-center gap-2 transition-colors ${currentView === 'dashboard' ? 'text-white font-bold' : 'hover:text-white'}`}
                                    >
                                        <LayoutDashboard className="w-4 h-4" /> Overview
                                    </button>
                                    <button
                                        onClick={() => setView('curriculum')}
                                        className={`flex items-center gap-2 transition-colors ${currentView === 'curriculum' ? 'text-white font-bold' : 'hover:text-white'}`}
                                    >
                                        <BookOpen className="w-4 h-4" /> Curriculum
                                    </button>
                                    <button
                                        onClick={() => setView('upload')}
                                        className={`flex items-center gap-2 transition-colors ${currentView === 'upload' ? 'text-white font-bold' : 'hover:text-white'}`}
                                    >
                                        <FileUp className="w-4 h-4" /> Syllabus
                                    </button>
                                    <div className="h-4 w-px bg-white/10 mx-2" />
                                    <button
                                        onClick={() => setView('settings')}
                                        className={`flex items-center gap-2 transition-colors ${currentView === 'settings' ? 'text-amber-500 font-bold' : 'hover:text-white'}`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black overflow-hidden relative">
                                            {photoURL && !imgError ? (
                                                <img
                                                    src={photoURL}
                                                    alt="Profile"
                                                    className="w-full h-full object-cover"
                                                    onError={() => setImgError(true)}
                                                />
                                            ) : (
                                                <span className="text-[10px] font-black">{initials}</span>
                                            )}
                                        </div>
                                        {getFirstName(displayName)}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </nav>
                <button className="md:hidden"><Menu className="w-6 h-6" /></button>
            </div>
        </header>
    );
};
