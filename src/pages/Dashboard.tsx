
import React from 'react';
import {
    AlertTriangle,
    ArrowUpRight,
    RefreshCcw,
    ChevronRight
} from 'lucide-react';

export const Dashboard: React.FC = () => {
    const readiness = 68;
    const riskStatus: 'Low' | 'Medium' | 'High' = 'Medium';

    return (
        <div className="pt-28 pb-24 px-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tighter mb-2 text-white">Morning, Candidate.</h1>
                    <p className="text-gray-500 font-light">You are <span className="text-amber-500 font-bold">12%</span> away from the validation threshold.</p>
                </div>
                <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 px-4 py-2 rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${riskStatus === 'Low' ? 'bg-green-500' : (riskStatus === 'Medium' ? 'bg-amber-500' : 'bg-red-500')}`} />
                    <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">RISK LEVEL:</span>
                    <span className={`text-sm font-black ${riskStatus === 'Low' ? 'text-green-500' : (riskStatus === 'Medium' ? 'text-amber-500' : 'text-red-500')}`}>{riskStatus.toUpperCase()}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                <div className="lg:col-span-2 bg-[#111] border border-white/5 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative w-64 h-64 flex-shrink-0">
                        <svg viewBox="0 0 320 320" className="w-full h-full -rotate-90">
                            <circle cx="160" cy="160" r="140" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
                            <circle cx="160" cy="160" r="140" fill="transparent" stroke="#fbbf24" strokeWidth="12" strokeDasharray="880" strokeDashoffset={880 - (880 * readiness / 100)} strokeLinecap="round" className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-6xl font-black tracking-tighter text-white">{readiness}%</span>
                            <span className="text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase">READINESS</span>
                        </div>
                    </div>
                    <div className="flex-grow text-center md:text-left">
                        <h3 className="text-2xl font-bold mb-4 tracking-tight text-white">The 80% Threshold Gap</h3>
                        <p className="text-gray-400 text-sm font-light leading-relaxed mb-6">You haven't reached the Master Standard yet. High probability of exam-day failure in your current state. The system recommends 48 hours of remediation focusing on <span className="text-white font-medium">Biochemistry</span>.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-xl">
                                <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Time Invested</div>
                                <div className="text-xl font-bold text-white">142h</div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl">
                                <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Modules Cleared</div>
                                <div className="text-xl font-bold text-white">14/22</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[#111] border border-white/5 rounded-2xl p-8">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white"><AlertTriangle className="w-5 h-5 text-amber-500" />Critical Weaknesses</h3>
                    <div className="space-y-6">
                        {[{ name: 'Biochemistry', score: 42, color: 'bg-red-500' }, { name: 'Immunology', score: 51, color: 'bg-orange-500' }, { name: 'Cardiovascular Path', score: 58, color: 'bg-amber-500' }].map((area, idx) => (
                            <div key={idx} className="group cursor-default">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">{area.name}</span>
                                    <span className="text-xs font-black text-amber-500">{area.score}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className={`h-full ${area.color} transition-all duration-700`} style={{ width: `${area.score}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8 pt-8 border-t border-white/5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Last 3 Attempts</h3>
                            <ArrowUpRight className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="flex items-end justify-between gap-2 h-16">
                            {[58, 62, 68].map((v, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full bg-amber-500/20 hover:bg-amber-500/40 transition-all rounded-t-sm" style={{ height: `${v}%` }} />
                                    <span className="text-[10px] font-bold text-gray-600">{v}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-amber-500 rounded-3xl p-1 md:p-1.5 shadow-2xl shadow-amber-500/10">
                <div className="bg-[#0a0a0a] rounded-[1.4rem] p-8 md:p-12 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">
                        <RefreshCcw className="w-8 h-8 text-amber-500 animate-spin-slow" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-4 text-white">What should I do next?</h2>
                    <p className="text-gray-400 max-w-xl mx-auto font-light mb-10 leading-relaxed">Your mastery in <span className="text-white font-bold">Biochemistry</span> is currently sub-standard. The system has prepared a 12-question hyper-focused loop to eliminate micro-gaps in Molecular Biology.</p>
                    <button className="bg-amber-500 hover:bg-amber-600 text-black px-12 py-6 rounded-xl font-black text-xl transition-all shadow-xl shadow-amber-500/20 flex items-center gap-3 active:scale-95 group">
                        Resume Mastery Loop: Biochemistry
                        <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
            <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
      `}</style>
        </div>
    );
};
