import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCcw, ChevronRight, TrendingUp, UploadCloud, BarChart3, Zap, Book } from 'lucide-react';
import { fetchDashboardSummary, listDocuments } from '../api';

interface DashboardProps {
    setView: (v: 'landing' | 'auth' | 'dashboard' | 'settings' | 'upload' | 'quiz-page' | 'quiz') => void;
    setQuizDocId: (id: string) => void;
    itemsError: string | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ setView, setQuizDocId, itemsError }) => {
    // Dashboard Metric State
    const [readiness, setReadiness] = useState(0);
    const [trend, setTrend] = useState<number[]>([0, 0, 0]);
    const [riskAreas, setRiskAreas] = useState<{ name: string; score: number }[]>([]);
    const [topWeaknesses, setTopWeaknesses] = useState<string[]>([]);
    const [summaryError, setSummaryError] = useState<string | null>(null);

    const [hasContent, setHasContent] = useState(false);
    const [nextActionType, setNextActionType] = useState<string>('upload');
    const [nextAction, setNextAction] = useState<string>('');

    // Document State
    const [documents, setDocuments] = useState<any[]>([]);

    // Helper logic
    const riskStatus = readiness >= 80 ? 'Low' : readiness >= 50 ? 'Medium' : 'High';
    const trendDelta = trend.length >= 2 ? trend[trend.length - 1] - trend[trend.length - 2] : 0;

    useEffect(() => {
        const loadData = async () => {
            try {
                const summary = await fetchDashboardSummary();
                setHasContent(summary.hasContent);
                setNextActionType(summary.nextActionType || 'upload');
                setNextAction(summary.nextAction || '');

                if (summary.hasContent) {
                    setReadiness(summary.readiness || 0);
                    setTrend(summary.trend || [0, 0, 0]);
                    setRiskAreas(summary.riskChapters || []);
                    setTopWeaknesses(summary.topWeaknesses || []);
                } else {
                    setReadiness(0);
                    setTrend([0, 0, 0]);
                    setRiskAreas([]);
                    setTopWeaknesses([]);
                }
                setSummaryError(null);

                const docs = await listDocuments();
                setDocuments(docs || []);

            } catch (err: any) {
                console.error("Dashboard Load Error:", err);
                setSummaryError(err.message || 'Unable to load dashboard data.');
            }
        };

        loadData();
    }, []);

    // Smart Action Logic — route based on nextActionType
    const handlePrimaryAction = () => {
        if (nextActionType === 'upload' || (!hasContent && documents.length === 0)) {
            setView('upload');
        } else if (nextActionType === 'expand') {
            setView('upload');
        } else {
            // diagnostic or subject → go to quiz page
            setView('quiz-page');
        }
    };

    // Determine CTA label and icon
    const getCtaConfig = () => {
        if (!hasContent && documents.length === 0) {
            return { label: 'Initialize Engine', color: 'amber' };
        }
        if (documents.length > 0 && !hasContent) {
            return { label: 'Start Diagnostic Quiz', color: 'amber' };
        }
        if (nextActionType === 'diagnostic') {
            return { label: 'Start Diagnostic Quiz', color: 'amber' };
        }
        if (nextActionType === 'subject') {
            return { label: 'Start Subject Quiz', color: 'amber' };
        }
        if (nextActionType === 'expand') {
            return { label: 'Upload New Material', color: 'green' };
        }
        return { label: 'Resume Mastery Loop', color: 'amber' };
    };

    const cta = getCtaConfig();

    return (
        <div className="pt-28 pb-24 px-6 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tighter mb-2 text-white">Morning, Candidate.</h1>
                    <p className="text-gray-500 font-light">
                        {hasContent
                            ? <span>You are <span className="text-amber-500 font-bold">{Math.max(0, 80 - readiness)}%</span> away from the validation threshold.</span>
                            : "Initialize your learning engine to generate analytics."
                        }
                    </p>
                </div>

                {hasContent && (
                    <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 px-4 py-2 rounded-lg">
                        <div className={`w-3 h-3 rounded-full ${riskStatus === 'Low' ? 'bg-green-500' : (riskStatus === 'Medium' ? 'bg-amber-500' : 'bg-red-500')}`} />
                        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">RISK LEVEL:</span>
                        <span className={`text-sm font-black ${riskStatus === 'Low' ? 'text-green-500' : (riskStatus === 'Medium' ? 'text-amber-500' : 'text-red-500')}`}>{riskStatus.toUpperCase()}</span>
                    </div>
                )}
            </div>

            {/* Analytics Grid — only if quizzes taken */}
            {hasContent ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 animate-in fade-in slide-in-from-bottom-4">
                    {/* Readiness Gauge */}
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
                            <p className="text-gray-400 text-sm font-light leading-relaxed mb-6">
                                {summaryError || itemsError ? (
                                    'We could not load your readiness data yet. Please refresh after uploads finish processing.'
                                ) : (
                                    `You are currently tracking at ${readiness}%. The system recommends focused revision until you cross the 80% mark.`
                                )}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-xl">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Exam Track</div>
                                    <div className="text-xl font-bold text-white">GATE</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Status</div>
                                    <div className="text-xl font-bold text-white">{riskStatus}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Critical Weaknesses & Trend */}
                    <div className="bg-[#111] border border-white/5 rounded-2xl p-8">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white"><AlertTriangle className="w-5 h-5 text-amber-500" />Critical Weaknesses</h3>
                        <div className="space-y-6">
                            {riskAreas.length === 0 ? (
                                <p className="text-gray-600 text-sm">No specific weak points detected yet.</p>
                            ) : (
                                riskAreas.map((area, idx) => (
                                    <div key={idx} className="group cursor-default">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">{area.name}</span>
                                            <span className="text-xs font-black text-amber-500">RISK: {area.score}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${area.score}%` }} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {topWeaknesses.length > 0 && (
                            <div className="mt-8 pt-8 border-t border-white/5">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Top Diagnosed Gaps</h3>
                                <div className="flex flex-wrap gap-2">
                                    {topWeaknesses.map((w, i) => (
                                        <div key={i} className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                            <span className="text-xs font-bold text-red-500 uppercase">{w}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-4 leading-relaxed italic">
                                    *Application gaps are weighted 1.5x in readiness calculation.
                                </p>
                            </div>
                        )}

                        <div className="mt-8 pt-8 border-t border-white/5">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Mastery Trend</h3>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full border border-green-500/20">
                                    <TrendingUp className="w-3 h-3" />
                                    <span className="text-[10px] font-black">{trendDelta >= 0 ? '+' : ''}{trendDelta}%</span>
                                </div>
                            </div>
                            <div className="flex items-end justify-start gap-4 h-24 relative px-4">
                                <div className="absolute inset-0 bg-gradient-to-t from-amber-500/5 to-transparent rounded-lg" />
                                {trend.map((v, i) => (
                                    <div key={i} className="w-12 flex flex-col items-center gap-2 relative z-10 group">
                                        <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                                            {v}%
                                        </div>
                                        <div
                                            className={`w-full transition-all duration-700 rounded-t-lg cursor-pointer ${i === trend.length - 1
                                                ? 'bg-amber-500 shadow-[0_-4px_12px_rgba(251,191,36,0.2)]'
                                                : 'bg-white/10 opacity-40 hover:opacity-80'
                                                }`}
                                            style={{ height: `${v}%` }}
                                        />
                                        <span className={`text-[10px] font-black tracking-tighter ${i === trend.length - 1 ? 'text-amber-500' : 'text-gray-700'}`}>
                                            T{i + 1}
                                        </span>
                                    </div>
                                ))}
                                {trend.length === 1 && (
                                    <div className="flex-grow flex items-center justify-center">
                                        <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Awaiting more data...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-12 p-12 border border-white/5 border-dashed rounded-3xl bg-[#0a0a0a] text-center flex flex-col items-center justify-center animate-in fade-in">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <BarChart3 className="w-10 h-10 text-gray-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">No Analytics Available Yet</h3>
                    <p className="text-gray-400 max-w-md mb-8">
                        {documents.length > 0
                            ? "Your syllabus is loaded. Take your first quiz to generate readiness analytics."
                            : "Upload your first syllabus or set of notes to get started."
                        }
                    </p>
                </div>
            )}

            {/* Smart Action Card — always visible */}
            <div className={`rounded-3xl p-1 md:p-1.5 shadow-2xl transition-colors duration-500 ${cta.color === 'green' ? 'bg-green-500 shadow-green-500/10' : 'bg-amber-500 shadow-amber-500/10'}`}>
                <div className="bg-[#0a0a0a] rounded-[1.4rem] p-8 md:p-12 text-center flex flex-col items-center">

                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-colors duration-500 ${cta.color === 'green' ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                        {cta.color === 'green' ? (
                            <UploadCloud className="w-8 h-8 text-green-500" />
                        ) : nextActionType === 'diagnostic' ? (
                            <Zap className="w-8 h-8 text-amber-500" />
                        ) : nextActionType === 'subject' ? (
                            <Book className="w-8 h-8 text-amber-500" />
                        ) : (
                            <RefreshCcw className="w-8 h-8 text-amber-500 animate-spin-slow" />
                        )}
                    </div>

                    <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-4 text-white">
                        What should I do next?
                    </h2>

                    <p className="text-gray-400 max-w-xl mx-auto font-light mb-10 leading-relaxed">
                        {nextAction || "System is waiting for source material. Upload notes to initialize the Mastery Engine."}
                    </p>

                    <div className="flex flex-col md:flex-row gap-4">
                        <button
                            onClick={handlePrimaryAction}
                            className={`px-12 py-6 rounded-xl font-black text-xl transition-all shadow-xl flex items-center gap-3 active:scale-95 group text-black
                                ${cta.color === 'green'
                                    ? 'bg-green-500 hover:bg-green-400 shadow-green-500/20'
                                    : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'}
                            `}
                        >
                            {cta.label}
                            {cta.color === 'green'
                                ? <UploadCloud className="w-6 h-6" />
                                : <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            }
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin-slow { animation: spin-slow 12s linear infinite; }
            `}</style>
        </div>
    );
};