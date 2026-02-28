
import React from 'react';
import { Logo } from './Logo';

export const Footer: React.FC = () => (
    <footer className="py-20 px-6 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
            <Logo size="sm" />

            <div className="flex items-center gap-8 text-xs font-bold text-gray-500 uppercase tracking-widest">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
                <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>

            <p className="text-gray-600 text-[10px] font-medium">
                © 2026 Master Learning Platform. All rights reserved.
            </p>
        </div>
    </footer>
);
