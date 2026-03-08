import React, { useState, useEffect, useMemo } from 'react';
import {
    Book,
    Zap,
    ChevronRight,
    CheckCircle2,
    X,
    Loader2,
    Microscope,
    Shield,
    Target,
    AlertTriangle,
    Archive,
    BookOpen,
} from 'lucide-react';
import { listDocuments, CurriculumItemDto } from '../api';

interface QuizPageProps {
    onStartQuiz: (docId: string, mode: 'subject' | 'diagnostic') => void;
}

export const QuizPage: React.FC<QuizPageProps> = ({ onStartQuiz }) => {
    const [selectedMode, setSelectedMode] = useState<'subject' | 'diagnostic' | null>(null);
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
    const [documents, setDocuments] = useState<CurriculumItemDto[]>([]);
    const [loading, setLoading] = useState(true);

    // Icon mapping for dynamic subjects
    const subjectIcons: Record<string, React.ReactNode> = {
        'Biochemistry': <Microscope className="w-5 h-5" />,
        'Immunology': <Shield className="w-5 h-5" />,
        'Physiology': <Zap className="w-5 h-5" />,
        'Microbiology': <AlertTriangle className="w-5 h-5" />,
        'Pharmacology': <Archive className="w-5 h-5" />,
        'Pathology': <Target className="w-5 h-5" />,
    };
    const defaultIcon = <BookOpen className="w-5 h-5" />;

    useEffect(() => {
        const load = async () => {
            try {
                const docs = await listDocuments();
                setDocuments(docs);
            } catch (err) {
                console.error('Failed to load documents:', err);
            }
            setLoading(false);
        };
        load();
    }, []);

    // Build unique subjects from curriculum data
    const subjects = useMemo(() => {
        const subjectMap = new Map<string, { id: string; name: string; docIds: string[] }>();
        documents
            .filter((d) => d.status === 'Active')
            .forEach((d) => {
                if (d.subject) {
                    const existing = subjectMap.get(d.subject);
                    if (existing) {
                        existing.docIds.push(d.id);
                    } else {
                        subjectMap.set(d.subject, {
                            id: d.subject.toLowerCase().replace(/\s+/g, '_'),
                            name: d.subject,
                            docIds: [d.id],
                        });
                    }
                }
            });
        return Array.from(subjectMap.values());
    }, [documents]);

    const toggleSubject = (id: string) => {
        setSelectedSubjects((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
        // Reset chapter selection when switching domains
        setSelectedChapterId(null);
    };

    const handleInitialize = () => {
        if (selectedMode === 'diagnostic') {
            // Signal diagnostic mode to the quiz runner
            onStartQuiz('diagnostic', 'diagnostic');
        } else if (selectedMode === 'subject' && selectedSubjects.length > 0) {
            // Find doc matching first selected subject
            const subjectName = subjects.find((s) => s.id === selectedSubjects[0])?.name;
            const matchingDoc = documents.find(
                (d) => d.subject === subjectName && d.status === 'Active'
            );
            if (matchingDoc) {
                // If a specific chapter has been selected, stash it so QuizView
                // can generate a chapter-scoped quiz via localStorage.
                if (selectedChapterId) {
                    localStorage.setItem('alp_quiz_doc_id', matchingDoc.id);
                    localStorage.setItem('alp_quiz_chapter_id', selectedChapterId);
                }
                onStartQuiz(matchingDoc.id, 'subject');
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-light">Loading curriculum data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-28 pb-24 px-6 max-w-7xl mx-auto animate-in fade-in">
            <div className="text-center mb-16">
                <h1 className="text-5xl font-black tracking-tighter text-white mb-4 uppercase">
                    Assessment Center
                </h1>
                <p className="text-gray-500 font-light max-w-2xl mx-auto">
                    Validate your mastery through high-fidelity simulations. Choose your assessment protocol.
                </p>
            </div>

            {subjects.length === 0 ? (
                <div className="max-w-xl mx-auto text-center py-20">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                        <BookOpen className="w-10 h-10 text-gray-600" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-400 mb-2">No Active Curricula</h3>
                    <p className="text-gray-600 font-light">
                        Upload and parse your study material first. Once your content is active, assessment modes will unlock here.
                    </p>
                </div>
            ) : !selectedMode ? (
                <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto animate-in slide-in-from-bottom-4">
                    {/* Subject Wise Quiz */}
                    <div
                        onClick={() => setSelectedMode('subject')}
                        className="group relative bg-[#111] border border-white/5 rounded-[3rem] p-12 cursor-pointer transition-all overflow-hidden hover:border-white/10"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.02] blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="relative z-10">
                            <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-8 border border-amber-500/20 group-hover:scale-110 transition-transform">
                                <Book className="w-10 h-10 text-amber-500" />
                            </div>
                            <h3 className="text-3xl font-black text-white mb-4">Subject Wise</h3>
                            <p className="text-gray-500 font-light leading-relaxed mb-8">
                                Target specific knowledge domains. Ideal for unit-wise mastery and closing identified micro-gaps.
                            </p>
                            <ul className="space-y-3 mb-10">
                                {['Domain Isolation', 'Adaptive Difficulty', 'Immediate Feedback'].map((feat, i) => (
                                    <li key={i} className="flex items-center gap-3 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        <CheckCircle2 className="w-4 h-4 text-amber-500" />
                                        {feat}
                                    </li>
                                ))}
                            </ul>
                            <div className="flex items-center gap-2 text-amber-500 font-black text-xs uppercase tracking-widest">
                                Select Domains <ChevronRight className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    {/* Diagnostic Quiz */}
                    <div
                        onClick={() => setSelectedMode('diagnostic')}
                        className="group relative bg-[#111] border border-white/5 rounded-[3rem] p-12 cursor-pointer transition-all overflow-hidden hover:border-white/10"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.02] blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="relative z-10">
                            <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-8 border border-amber-500/20 group-hover:scale-110 transition-transform">
                                <Zap className="w-10 h-10 text-amber-500" />
                            </div>
                            <h3 className="text-3xl font-black text-white mb-4">Diagnostic</h3>
                            <p className="text-gray-500 font-light leading-relaxed mb-8">
                                Full-spectrum assessment across all synchronized curricula. Benchmarks your overall readiness score.
                            </p>
                            <ul className="space-y-3 mb-10">
                                {['Comprehensive Coverage', 'Timed Simulation', 'Readiness Benchmarking'].map((feat, i) => (
                                    <li key={i} className="flex items-center gap-3 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        <CheckCircle2 className="w-4 h-4 text-amber-500" />
                                        {feat}
                                    </li>
                                ))}
                            </ul>
                            <div className="flex items-center gap-2 text-amber-500 font-black text-xs uppercase tracking-widest">
                                Start Simulation <ChevronRight className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                </div>
            ) : selectedMode === 'subject' ? (
                <div className="max-w-7xl mx-auto animate-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-10">
                        <button
                            onClick={() => {
                                setSelectedMode(null);
                                setSelectedSubjects([]);
                                setSelectedChapterId(null);
                                localStorage.removeItem('alp_quiz_doc_id');
                                localStorage.removeItem('alp_quiz_chapter_id');
                            }}
                            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
                        >
                            <X className="w-4 h-4" /> Back to Mode Selection
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        {/* 1. Subject Selection */}
                        <div className="lg:col-span-5 space-y-4">
                            <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[8px]">1</span>
                                Select Subject
                            </h4>
                            <div className="space-y-3">
                                {subjects.map((subject) => (
                                    <button
                                        key={subject.id}
                                        onClick={() => toggleSubject(subject.id)}
                                        className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group ${selectedSubjects.includes(subject.id)
                                            ? 'bg-amber-500 border-amber-500 text-black'
                                            : 'bg-white/5 border-white/10 text-white hover:border-white/20'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${selectedSubjects.includes(subject.id) ? 'bg-black/10 border-black/10' : 'bg-white/5 border-white/10'
                                            }`}>
                                            {subjectIcons[subject.name] || defaultIcon}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-black text-xs uppercase tracking-tight">{subject.name}</p>
                                            <p className={`text-[9px] font-bold uppercase tracking-widest ${selectedSubjects.includes(subject.id) ? 'text-black/60' : 'text-gray-600'}`}>
                                                {subject.docIds.length} Modules
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Topic (Document) Selection */}
                        <div className="lg:col-span-7 space-y-4">
                            <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[8px]">2</span>
                                Select Module / Topic
                            </h4>
                            <div className="space-y-3">
                                {selectedSubjects.length === 0 ? (
                                    <div className="h-48 border border-white/5 bg-white/[0.02] rounded-3xl flex items-center justify-center border-dashed">
                                        <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Awaiting Domain Selection</p>
                                    </div>
                                ) : (
                                    documents
                                        .filter(d => d.subject === subjects.find(s => s.id === selectedSubjects[0])?.name && d.status === 'Active')
                                        .map((doc) => {
                                            const isSelected = localStorage.getItem('alp_quiz_doc_id') === doc.id;
                                            return (
                                                <button
                                                    key={doc.id}
                                                    onClick={() => {
                                                        localStorage.setItem('alp_quiz_doc_id', doc.id);
                                                        localStorage.removeItem('alp_quiz_chapter_id');
                                                        setSelectedChapterId(null);
                                                        // Force re-render
                                                        setDocuments([...documents]);
                                                    }}
                                                    className={`w-full p-4 rounded-2xl border transition-all flex items-start gap-4 ${isSelected
                                                        ? 'bg-white/10 border-amber-500/50 text-white'
                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                                                        }`}
                                                >
                                                    <div className={`mt-1 w-2 h-2 rounded-full ${isSelected ? 'bg-amber-500' : 'bg-gray-800'}`} />
                                                    <div className="text-left flex-grow truncate">
                                                        <p className="font-black text-xs uppercase tracking-tight truncate">{doc.topic || doc.fileName}</p>
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mt-1">
                                                            {doc.chapters.length} Chapters Extracted
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })
                                )}
                            </div>
                        </div>

                    </div>

                    <div className="mt-16 text-center">
                        <button
                            disabled={!localStorage.getItem('alp_quiz_doc_id')}
                            onClick={handleInitialize}
                            className="bg-amber-500 hover:bg-amber-600 disabled:bg-white/5 disabled:text-gray-800 disabled:border-white/5 text-black px-16 py-6 rounded-3xl font-black text-xl transition-all shadow-2xl shadow-amber-500/20 flex items-center justify-center gap-4 mx-auto group active:scale-95 border border-amber-400/20"
                        >
                            Initialize Module Protocol
                            <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                        </button>
                        <p className="mt-6 text-[10px] font-black text-gray-700 uppercase tracking-[0.2em]">
                            End-to-end knowledge validation sequence
                        </p>
                    </div>
                </div>
            ) : (
                /* Diagnostic Confirmation */
                <div className="max-w-2xl mx-auto text-center animate-in slide-in-from-bottom-4">
                    <div className="bg-[#111] border border-white/5 rounded-[3rem] p-12 mb-10">
                        <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-8 border border-amber-500/20 mx-auto">
                            <Zap className="w-10 h-10 text-amber-500" />
                        </div>
                        <h3 className="text-3xl font-black text-white mb-4">Diagnostic Simulation</h3>
                        <p className="text-gray-500 font-light leading-relaxed mb-10">
                            You are about to begin a full-spectrum diagnostic assessment. This will evaluate your readiness across all{' '}
                            {documents.filter((d) => d.status === 'Active').length} synchronized knowledge modules.
                        </p>
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={handleInitialize}
                                className="bg-amber-500 hover:bg-amber-600 text-black px-12 py-6 rounded-2xl font-black text-xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-4 group"
                            >
                                Confirm & Initialize
                                <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                            </button>
                            <button
                                onClick={() => setSelectedMode(null)}
                                className="text-gray-600 hover:text-white transition-colors text-xs font-black uppercase tracking-widest py-4"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
