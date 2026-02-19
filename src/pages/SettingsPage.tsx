
import React, { useState } from 'react';
import {
    User,
    Award,
    Settings,
    LogOut,
    Camera,
    Shield,
    Calendar,
    Target,
    BookMarked
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface SettingsPageProps {
    onLogout: () => void;
    user: FirebaseUser | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onLogout, user }) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'exam'>('profile');
    const [imgError, setImgError] = useState(false);

    const getInitials = (displayName: string | null) => {
        if (!displayName) return 'C';
        const names = displayName.trim().split(/\s+/);
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return names[0][0].toUpperCase();
    };

    const displayName = user?.displayName || 'Candidate';
    const email = user?.email || 'No email';
    const photoURL = user?.photoURL;
    const initials = getInitials(user?.displayName);

    return (
        <div className="pt-28 pb-24 px-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-12">
                <h1 className="text-4xl font-black tracking-tighter text-white">Account
                </h1>
                <button
                    onClick={onLogout}
                    className="flex items-center gap-2 text-xs font-black text-red-500 hover:text-red-400 transition-colors uppercase tracking-widest px-4 py-2 bg-red-500/5 rounded-lg border border-red-500/10"
                >
                    <LogOut className="w-4 h-4" /> Log out

                </button>
            </div>

            <div className="grid md:grid-cols-4 gap-8">
                {/* Sidebar Nav */}
                <div className="md:col-span-1 space-y-2">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-500 hover:bg-white/5'}`}
                    >
                        <User className="w-4 h-4" /> Identity
                    </button>
                    <button
                        onClick={() => setActiveTab('exam')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'exam' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-500 hover:bg-white/5'}`}
                    >
                        <Award className="w-4 h-4" /> Exam Track
                    </button>
                    <button
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold text-gray-500 hover:bg-white/5 opacity-50 cursor-not-allowed"
                    >
                        <Settings className="w-4 h-4" /> Preferences
                    </button>
                </div>

                {/* Content Area */}
                <div className="md:col-span-3 space-y-8">
                    {activeTab === 'profile' ? (
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-6 mb-10">
                                <div className="relative group">
                                    <div className="w-24 h-24 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center text-black shadow-2xl relative overflow-hidden">
                                        {photoURL && !imgError ? (
                                            <img
                                                src={photoURL}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                                onError={() => setImgError(true)}
                                            />
                                        ) : (
                                            <span className="text-3xl font-black">{initials}</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <Camera className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white max-w-[200px] truncate">{displayName}</h3>
                                    <p className="text-gray-500 text-sm font-light truncate max-w-[250px]">Email:
                                        {email}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Full Name</label>
                                    <input className="w-full bg-black/40 border border-white/5 rounded-lg p-3 text-sm focus:border-amber-500/50 outline-none text-white" defaultValue={displayName} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Institutional Email</label>
                                    <input className="w-full bg-black/40 border border-white/5 rounded-lg p-3 text-sm opacity-50 cursor-not-allowed text-white" disabled defaultValue={email} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Verification Status</label>
                                    <div className="flex items-center gap-2 text-green-500 text-sm font-bold p-3 bg-green-500/5 rounded-lg border border-green-500/10">
                                        <Shield className="w-4 h-4" fill="currentColor" /> Active (Standard Plan)
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-3 mb-8">
                                <Award className="w-6 h-6 text-amber-500" />
                                <h3 className="text-xl font-bold text-white">Current Specialization</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Current Track</label>
                                    <select className="w-full bg-black/40 border border-white/5 rounded-lg p-3 text-sm focus:border-amber-500/50 outline-none appearance-none text-white">
                                        <option>GATE (CSE)</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Target Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                            <input type="date" className="w-full bg-black/40 border border-white/5 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-amber-500/50 outline-none text-white" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Target Score</label>
                                        <div className="relative">
                                            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                            <input type="number" className="w-full bg-black/40 border border-white/5 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-amber-500/50 outline-none text-white" defaultValue="255" />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6">
                                    <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex gap-4">
                                        <BookMarked className="w-5 h-5 text-amber-500 shrink-0" />
                                        <p className="text-xs text-gray-400 font-light leading-relaxed">
                                            Your exam preference dictates the source analysis engine. Changing tracks will reset your current mastery progress for the new curriculum.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-4">
                        <button className="px-6 py-3 rounded-lg text-sm font-bold text-gray-500 hover:text-white transition-colors">Discard</button>
                        <button className="px-8 py-3 bg-amber-500 text-black rounded-lg text-sm font-black shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all">Save Changes</button>
                    </div>
                </div>
            </div>
            <style>{`
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
};
