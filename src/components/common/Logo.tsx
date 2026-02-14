
import React from 'react';
import { Shield } from 'lucide-react';

export const Logo: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => (
    <div className="flex items-center gap-2">
        <div className={`${size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'} bg-amber-500 flex items-center justify-center rounded-sm`}>
            <Shield className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} text-black`} fill="currentColor" />
        </div>
        <span className={`font-extrabold tracking-tighter ${size === 'sm' ? 'text-lg' : 'text-xl'} uppercase`}>Master</span>
    </div>
);
