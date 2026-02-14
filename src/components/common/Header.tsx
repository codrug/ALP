
import React from 'react';
import { Shield, Menu, LogOut } from 'lucide-react';
import { Logo } from './Logo';

interface HeaderProps {
    onLoginClick: () => void;
    onSignupClick: () => void;
    userEmail: string | null;
    onLogout: () => void;
    currentView: 'home' | 'login' | 'signup' | 'dashboard';
}

export const Header: React.FC<HeaderProps> = ({ onLoginClick, onSignupClick, userEmail, onLogout, currentView }) => (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="cursor-pointer" onClick={() => window.location.reload()}>
                <Logo size="md" />
            </div>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                {userEmail || currentView === 'dashboard' ? (
                    <>
                        <span className="text-white font-bold flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            USMLE Step 1 Prep
                        </span>
                        <div className="h-4 w-px bg-white/10 mx-2" />
                        {userEmail && <span className="text-white text-xs hidden lg:block">{userEmail}</span>}
                        <button
                            onClick={onLogout}
                            className="hover:text-white transition-colors flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded-md"
                        >
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    </>
                ) : (
                    <>
                        <a href="#" className="hover:text-amber-500 transition-colors">The Standard</a>
                        <a href="#" className="hover:text-amber-500 transition-colors">The Loop</a>
                        <a href="#" className="hover:text-amber-500 transition-colors">Features</a>
                        <div className="h-4 w-px bg-white/10 mx-2" />
                        <button onClick={onLoginClick} className="hover:text-amber-500 transition-colors">Login</button>
                        <button onClick={onSignupClick} className="bg-amber-500 hover:bg-amber-600 text-black px-5 py-2 rounded-md font-bold text-xs transition-all">
                            Get Started
                        </button>
                    </>
                )}
            </nav>

            <button className="md:hidden">
                <Menu className="w-6 h-6" />
            </button>
        </div>
    </header>
);
