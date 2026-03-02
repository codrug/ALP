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
            // Use first active document for diagnostic
            const activeDoc = documents.find((d) => d.status === 'Active');
            if (activeDoc) {
                onStartQuiz(activeDoc.id, 'diagnostic');
            }
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
                <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-10">
                        <button
                            onClick={() => {
                                setSelectedMode(null);
                                setSelectedSubjects([]);
                                setSelectedChapterId(null);
                            }}
                            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
                        >
                            <X className="w-4 h-4" /> Back to Mode Selection
                        </button>
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20">
                            {selectedSubjects.length} Domains Selected
                        </span>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 mb-16">
                        {/* Domain selection */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {subjects.map((subject) => (
                                <div
                                    key={subject.id}
                                    onClick={() => toggleSubject(subject.id)}
                                    className={`p-6 rounded-[2rem] border transition-all cursor-pointer flex flex-col items-center text-center group ${
                                        selectedSubjects.includes(subject.id)
                                            ? 'bg-amber-500 border-amber-500 text-black shadow-2xl shadow-amber-500/20'
                                            : 'bg-[#111] border-white/5 text-white hover:border-white/10'
                                    }`}
                                >
                                    <div
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border transition-all ${
                                            selectedSubjects.includes(subject.id)
                                                ? 'bg-black/10 border-black/20'
                                                : 'bg-white/5 border-white/10 group-hover:border-amber-500/30'
                                        }`}
                                    >
                                        <div className={selectedSubjects.includes(subject.id) ? 'text-black' : 'text-amber-500'}>
                                            {subjectIcons[subject.name] || defaultIcon}
                                        </div>
                                    </div>
                                    <h4 className="font-black text-base uppercase tracking-tight">{subject.name}</h4>
                                    <p className="text-[10px] mt-2 opacity-60 font-bold uppercase tracking-widest">
                                        {subject.docIds.length} {subject.docIds.length === 1 ? 'module' : 'modules'}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Chapter selection for first selected subject */}
                        <div className="bg-[#111] border border-white/5 rounded-3xl p-6">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                                Target Chapter (Optional)
                            </h4>
                            {selectedSubjects.length === 0 ? (
                                <p className="text-gray-600 text-xs">
                                    Select a domain to view its chapters and isolate a specific unit for assessment.
                                </p>
                            ) : (
                                (() => {
                                    const selectedSubject = subjects.find(
                                        (s) => s.id === selectedSubjects[0]
                                    );
                                    const subjectName = selectedSubject?.name;
                                    const matchingDoc = documents.find(
                                        (d) => d.subject === subjectName && d.status === 'Active'
                                    );
                                    const chapters = matchingDoc?.chapters || [];

                                    if (!matchingDoc || chapters.length === 0) {
                                        return (
                                            <p className="text-gray-600 text-xs">
                                                No chapter metadata found for this domain. You can still run a full
                                                subject-wise quiz.
                                            </p>
                                        );
                                    }

                                    return (
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                            {chapters.map((chapter) => (
                                                <button
                                                    key={chapter.id}
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedChapterId(
                                                            selectedChapterId === chapter.id ? null : chapter.id
                                                        )
                                                    }
                                                    className={`w-full text-left text-xs px-3 py-2 rounded-xl border transition-all ${
                                                        selectedChapterId === chapter.id
                                                            ? 'bg-amber-500 text-black border-amber-500'
                                                            : 'bg-white/5 text-gray-300 border-white/10 hover:border-amber-500/40'
                                                    }`}
                                                >
                                                    <span className="block font-bold truncate">
                                                        {chapter.title || `Chapter ${chapter.id}`}
                                                    </span>
                                                    {chapter.concepts?.length > 0 && (
                                                        <span className="block text-[10px] text-gray-500 truncate">
                                                            {chapter.concepts.slice(0, 2).join(' • ')}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                    </div>

                    <div className="text-center">
                        <button
                            disabled={selectedSubjects.length === 0}
                            onClick={handleInitialize}
                            className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-800 disabled:opacity-50 text-black px-20 py-6 rounded-[2.5rem] font-black text-2xl transition-all shadow-2xl shadow-amber-500/20 flex items-center justify-center gap-4 mx-auto group active:scale-95"
                        >
                            {selectedChapterId ? 'Initialize Chapter Loop' : 'Initialize Subject Loop'}
                            <ChevronRight className="w-8 h-8 group-hover:translate-x-3 transition-transform" />
                        </button>
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
