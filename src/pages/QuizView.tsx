import React, { useState, useEffect } from 'react';
import { ArrowRight, AlertCircle, CheckCircle, XCircle, Loader2, Trophy, RefreshCw, X, AlertTriangle, ChevronRight, Eye, EyeOff, Flag, BookOpen, RotateCcw } from 'lucide-react';
import { API_BASE_URL, fetchRemediation, triggerReassessment, flagQuestion, RemediationDto } from '../api';

interface QuizViewProps {
    docId: string | null;
    setView: (v: 'dashboard' | 'upload' | 'quiz-page') => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ docId, setView }) => {
    // Quiz State
    const [questions, setQuestions] = useState<any[]>([]);
    const [quizId, setQuizId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Interaction State
    const [currentQ, setCurrentQ] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<any>(null);
    const [score, setScore] = useState(0);
    const [weightedScore, setWeightedScore] = useState(0);
    const [weaknesses, setWeaknesses] = useState<string[]>([]);
    const [isFinished, setIsFinished] = useState(false);

    // Exit Warning State
    const [showExitWarning, setShowExitWarning] = useState(false);

    // Answer History for Review
    const [answerHistory, setAnswerHistory] = useState<{
        questionIndex: number;
        selectedOption: number;
        correct: boolean;
        correctIndex: number;
        explanation: string;
        questionText: string;
        options: string[];
        gap_type?: string;
    }[]>([]);

    // Review Mode
    const [showReview, setShowReview] = useState(false);

    // ─── Remediation State (PRD §6.6) ─────────────────────────
    const [showRemediation, setShowRemediation] = useState(false);
    const [remediation, setRemediation] = useState<RemediationDto | null>(null);
    const [remediationLoading, setRemediationLoading] = useState(false);
    const [remediationError, setRemediationError] = useState<string | null>(null);

    // ─── Reassessment State (PRD §6.7) ────────────────────────
    const [reassessLoading, setReassessLoading] = useState(false);

    // ─── Flag State (PRD §12.3) ───────────────────────────────
    const [flaggingIndex, setFlaggingIndex] = useState<number | null>(null);
    const [flagNote, setFlagNote] = useState('');
    const [flagStatus, setFlagStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

    // 1. Generate Quiz
    const startQuiz = async () => {
        if (!docId) return;
        setLoading(true);
        setError(null);
        try {
            let data: any;

            if (docId === 'diagnostic') {
                // Call specialization diagnostic route
                const { generateDiagnosticQuiz } = await import('../api');
                data = await generateDiagnosticQuiz();
            } else {
                // Optional chapter-level targeting
                let chapterIdParam: string | null = null;
                const storedDocId = localStorage.getItem('alp_quiz_doc_id');
                const storedChapterId = localStorage.getItem('alp_quiz_chapter_id');
                if (storedDocId && storedChapterId && storedDocId === docId) {
                    chapterIdParam = storedChapterId;
                }

                let url = `${API_BASE_URL}/quiz/generate/${docId}`;
                if (chapterIdParam) {
                    url += `?chapter_id=${encodeURIComponent(chapterIdParam)}`;
                }

                const res = await fetch(url, { method: 'POST' });
                if (!res.ok) {
                    const errorPayload = await res.json();
                    throw new Error(errorPayload.detail || "Failed to generate quiz");
                }
                data = await res.json();
            }

            setQuestions(data.questions);
            setQuizId(data.quiz_id);
            setLoading(false);

            // Clear any one-time targeting
            localStorage.removeItem('alp_quiz_doc_id');
            localStorage.removeItem('alp_quiz_chapter_id');
        } catch (err: any) {
            console.error("Failed to start quiz", err);
            setError(err.message || "Failed to start assessment loop. The AI engine might be busy.");
            setLoading(false);
        }
    };

    // Start quiz from a reassessment result (already has quiz_id + questions)
    const startFromReassessment = (newQuizId: string, newQuestions: any[]) => {
        setQuizId(newQuizId);
        setQuestions(newQuestions);
        setCurrentQ(0);
        setSelected(null);
        setFeedback(null);
        setScore(0);
        setWeightedScore(0);
        setWeaknesses([]);
        setAnswerHistory([]);
        setIsFinished(false);
        setShowReview(false);
        setShowRemediation(false);
        setRemediation(null);
        setRemediationError(null);
        setLoading(false);
    };

    useEffect(() => {
        startQuiz();
    }, [docId]);

    // 2. Submit Answer
    const handleSubmit = async () => {
        if (!quizId || selected === null) return;

        const res = await fetch(`${API_BASE_URL}/quiz/${quizId}/submit?question_index=${currentQ}&selected_option=${selected}`, {
            method: 'POST'
        });
        const data = await res.json();
        setFeedback(data);

        if (data.correct) {
            setScore(prev => prev + 1);
        } else {
            if (data.gap_type) {
                setWeaknesses(prev => [...prev, data.gap_type]);
            }
        }

        // Record answer for review
        setAnswerHistory(prev => [...prev, {
            questionIndex: currentQ,
            selectedOption: selected,
            correct: data.correct,
            correctIndex: data.correct_index,
            explanation: data.explanation,
            gap_type: data.gap_type,
            questionText: questions[currentQ].question,
            options: questions[currentQ].options,
        }]);
    };

    // 3. Next Question or Finish
    const handleNext = () => {
        if (currentQ < questions.length - 1) {
            setCurrentQ(prev => prev + 1);
            setSelected(null);
            setFeedback(null);
        } else {
            // Calculate weighted mastery before finishing
            const foundationWrong = weaknesses.filter(w => w.toLowerCase() === 'foundation').length;
            const applicationWrong = weaknesses.filter(w => w.toLowerCase() === 'application').length;
            const otherWrong = weaknesses.length - foundationWrong - applicationWrong;

            const effectiveWrong = foundationWrong + otherWrong + (1.5 * applicationWrong);
            const totalQ = questions.length;
            const effectiveCorrect = Math.max(0, totalQ - effectiveWrong);
            const weighted = Math.round((effectiveCorrect / totalQ) * 100);

            setWeightedScore(weighted);
            setIsFinished(true);
        }
    };

    // 4. Exit Warning Handler
    const handleExitRequest = () => {
        if (isFinished) {
            setView('dashboard');
        } else {
            setShowExitWarning(true);
        }
    };

    const confirmExit = () => {
        setShowExitWarning(false);
        setView('dashboard');
    };

    // ─── PRD §6.6 — Fetch Remediation ──────────────────────────
    const handleFetchRemediation = async () => {
        if (!quizId) return;
        setRemediationLoading(true);
        setRemediationError(null);
        try {
            const data = await fetchRemediation(quizId);
            setRemediation(data);
            setShowRemediation(true);
        } catch (err: any) {
            setRemediationError(err.message || 'Failed to load remediation.');
        } finally {
            setRemediationLoading(false);
        }
    };

    // ─── PRD §6.7 — Trigger Reassessment ────────────────────────
    const handleReassess = async () => {
        if (!quizId) return;
        setReassessLoading(true);
        try {
            const data = await triggerReassessment(quizId);
            // Start a new quiz session with the reassessment data
            startFromReassessment(data.quiz_id, data.questions);
        } catch (err: any) {
            setRemediationError(err.message || 'Failed to start reassessment.');
        } finally {
            setReassessLoading(false);
        }
    };

    // ─── PRD §12.3 — Flag Question ──────────────────────────────
    const handleFlag = async (errorType: string) => {
        if (!quizId || flaggingIndex === null) return;
        setFlagStatus('sending');
        try {
            await flagQuestion(quizId, flaggingIndex, errorType, flagNote);
            setFlagStatus('sent');
            setTimeout(() => {
                setFlaggingIndex(null);
                setFlagNote('');
                setFlagStatus('idle');
            }, 2000);
        } catch (err: any) {
            console.error('Flag failed:', err);
            setFlagStatus('idle');
        }
    };

    // --- LOADING SCREEN (full-screen) ---
    if (loading) return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center">
                <div className="w-24 h-24 bg-amber-500/10 rounded-[2rem] flex items-center justify-center mb-10 border border-amber-500/20 mx-auto">
                    <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                </div>
                <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Initializing Assessment</h2>
                <p className="text-gray-500 font-light">Isolating knowledge modules and generating high-fidelity simulation...</p>
            </div>
        </div>
    );

    // --- ERROR SCREEN (full-screen) ---
    if (error) return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-[#111] border border-red-500/20 rounded-3xl p-10 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-white mb-4">Assessment Failed</h2>
                <p className="text-gray-400 mb-8 leading-relaxed">{error}</p>
                <div className="flex flex-col gap-4">
                    <button
                        onClick={startQuiz}
                        className="w-full bg-amber-500 text-black font-black py-4 rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Retry Generation
                    </button>
                    <button
                        onClick={() => setView('dashboard')}
                        className="w-full bg-white/5 text-gray-400 font-bold py-4 rounded-xl hover:bg-white/10 transition-all"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );

    // --- RESULT SCREEN with Review / Remediation / Reassessment ---
    if (isFinished) {
        const percentage = Math.round((score / questions.length) * 100);
        const isPassed = percentage >= 80;

        // ─── REMEDIATION SCREEN ─────────────────────────────────
        if (showRemediation && remediation) {
            return (
                <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
                    <div className="max-w-3xl w-full animate-in fade-in">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                                    <BookOpen className="w-5 h-5 text-blue-500" />
                                </div>
                                <h2 className="text-3xl font-black text-white tracking-tighter">Targeted Remediation</h2>
                            </div>
                            <button
                                onClick={() => setShowRemediation(false)}
                                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
                            >
                                <X className="w-4 h-4" /> Back to Score
                            </button>
                        </div>

                        {/* Gap Summary */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6">
                                <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Foundation Gaps</div>
                                <div className="text-3xl font-black text-white">{remediation.weaknesses_summary?.foundation || 0}</div>
                            </div>
                            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
                                <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Application Gaps</div>
                                <div className="text-3xl font-black text-white">{remediation.weaknesses_summary?.application || 0}</div>
                            </div>
                        </div>

                        {/* Dominant Gap Badge */}
                        <div className="mb-6">
                            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border ${remediation.gap_type === 'Application'
                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                    : remediation.gap_type === 'none'
                                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                        : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                }`}>
                                {remediation.gap_type === 'none' ? '✓ No Gaps' : `Primary Gap: ${remediation.gap_type}`}
                            </span>
                        </div>

                        {/* Remediation Content */}
                        <div className="bg-[#111] border border-white/10 rounded-2xl p-8 mb-8">
                            <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest mb-4">AI-Generated Study Guide</h3>
                            <div className="prose prose-invert max-w-none">
                                <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">{remediation.remediation}</div>
                            </div>
                        </div>

                        {/* Weak Concepts */}
                        {remediation.weak_concepts.length > 0 && (
                            <div className="mb-8">
                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Focus Areas</h4>
                                <div className="flex flex-wrap gap-2">
                                    {remediation.weak_concepts.map((c, i) => (
                                        <span key={i} className="px-3 py-1.5 bg-red-500/5 border border-red-500/10 text-red-400 text-xs rounded-lg font-medium truncate max-w-xs">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col md:flex-row gap-4 justify-center">
                            <button
                                onClick={handleReassess}
                                disabled={reassessLoading}
                                className="px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-xl flex items-center justify-center gap-3 bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20 disabled:opacity-50"
                            >
                                {reassessLoading ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
                                ) : (
                                    <><RotateCcw className="w-5 h-5" /> Reassess Weak Areas</>
                                )}
                            </button>
                            <button
                                onClick={() => setView('dashboard')}
                                className="px-8 py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border border-white/10 bg-white/5 text-white hover:bg-white/10"
                            >
                                Return to Dashboard
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {remediationError && (
                            <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl text-center">
                                {remediationError}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
                <div className="max-w-3xl w-full">
                    {!showReview ? (
                        /* Score Summary */
                        <div className="bg-[#111] border border-white/10 rounded-[3rem] p-12 text-center relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 ${isPassed ? 'bg-green-500/10' : 'bg-amber-500/10'}`} />

                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isPassed ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                                {isPassed ? <Trophy className="w-10 h-10 text-green-500" /> : <RefreshCw className="w-10 h-10 text-amber-500" />}
                            </div>

                            <h2 className="text-5xl font-black text-white mb-2 uppercase tracking-tighter">Session Complete</h2>
                            <div className="text-[10px] font-black text-amber-500/60 uppercase tracking-[0.3em] mb-2">Weighted Mastery Score</div>
                            <div className={`text-8xl font-black mb-4 ${isPassed ? 'text-green-500' : 'text-amber-500'}`}>{weightedScore}%</div>

                            <div className="flex flex-col items-center mb-8">
                                <p className="text-gray-400 mb-2 font-light">
                                    {score}/{questions.length} Correct
                                </p>
                                <div className="flex gap-2">
                                    {Array.from(new Set(weaknesses)).slice(0, 3).map((w, i) => (
                                        <span key={i} className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase rounded-full">
                                            {w} Gap Detected
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-10 max-w-lg mx-auto">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <div className="text-[10px] font-black text-blue-500 uppercase mb-1">Foundation</div>
                                    <div className="text-2xl font-black text-white">
                                        {answerHistory.filter(h => h.gap_type?.toLowerCase() === 'foundation').length > 0
                                            ? Math.round((answerHistory.filter(h => h.correct && h.gap_type?.toLowerCase() === 'foundation').length / answerHistory.filter(h => h.gap_type?.toLowerCase() === 'foundation').length) * 100)
                                            : 100}%
                                    </div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <div className="text-[10px] font-black text-amber-500 uppercase mb-1">Application</div>
                                    <div className="text-2xl font-black text-white">
                                        {answerHistory.filter(h => h.gap_type?.toLowerCase() === 'application').length > 0
                                            ? Math.round((answerHistory.filter(h => h.correct && h.gap_type?.toLowerCase() === 'application').length / answerHistory.filter(h => h.gap_type?.toLowerCase() === 'application').length) * 100)
                                            : 100}%
                                    </div>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-gray-300 mb-8">
                                {isPassed ? "Mastery Achieved!" : "Critical Gaps Identified"}
                            </h3>

                            <p className="text-gray-500 mb-10 leading-relaxed max-w-lg mx-auto">
                                {isPassed
                                    ? "You've demonstrated command of the core concepts. Application gaps were weighted 1.5x in this evaluation."
                                    : `We detected specific gaps in your understanding, particularly in ${weaknesses.filter(w => w.toLowerCase() === 'application').length >= weaknesses.filter(w => w.toLowerCase() === 'foundation').length ? 'Application' : 'Foundation'}-level reasoning.`}
                            </p>

                            <div className="flex flex-col md:flex-row gap-4 justify-center">
                                <button
                                    onClick={() => setShowReview(true)}
                                    className="px-8 py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                >
                                    <Eye className="w-5 h-5" />
                                    Review Detailed Gaps
                                </button>

                                {/* Remediation Button (PRD §6.6) */}
                                {weaknesses.length > 0 && (
                                    <button
                                        onClick={handleFetchRemediation}
                                        disabled={remediationLoading}
                                        className="px-8 py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
                                    >
                                        {remediationLoading ? (
                                            <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</>
                                        ) : (
                                            <><BookOpen className="w-5 h-5" /> Get Remediation</>
                                        )}
                                    </button>
                                )}

                                <button
                                    onClick={() => setView('dashboard')}
                                    className={`px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-xl flex items-center justify-center gap-2 ${isPassed ? 'bg-green-500 text-black hover:bg-green-400 shadow-green-500/20' : 'bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20'}`}
                                >
                                    Return to Dashboard
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            {remediationError && (
                                <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                                    {remediationError}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Review Mode */
                        <div className="animate-in fade-in">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-3xl font-black text-white tracking-tighter">Answer Review</h2>
                                <button
                                    onClick={() => setShowReview(false)}
                                    className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
                                >
                                    <EyeOff className="w-4 h-4" /> Back to Score
                                </button>
                            </div>

                            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                                {answerHistory.map((item, idx) => (
                                    <div key={idx} className={`bg-[#111] border rounded-2xl p-8 ${item.correct ? 'border-green-500/20' : 'border-red-500/20'}`}>
                                        <div className="flex items-start gap-4 mb-6">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.correct ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                                {item.correct
                                                    ? <CheckCircle className="w-5 h-5 text-green-500" />
                                                    : <XCircle className="w-5 h-5 text-red-500" />
                                                }
                                            </div>
                                            <div className="flex-grow">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Question {idx + 1}</span>
                                                    {item.gap_type && (
                                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${item.gap_type.toLowerCase() === 'application' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                                            {item.gap_type}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-lg font-bold text-white">{item.questionText}</h3>
                                            </div>
                                            {/* Flag Button (PRD §12.3) */}
                                            <button
                                                onClick={() => setFlaggingIndex(idx)}
                                                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 transition-all group"
                                                title="Report this question"
                                            >
                                                <Flag className="w-3.5 h-3.5 text-gray-600 group-hover:text-red-500 transition-colors" />
                                            </button>
                                        </div>

                                        <div className="space-y-2 mb-6">
                                            {item.options.map((opt: string, optIdx: number) => {
                                                let optStyle = 'border-white/5 bg-white/[0.01] text-gray-600';
                                                if (optIdx === item.correctIndex) {
                                                    optStyle = 'border-green-500/30 bg-green-500/5 text-green-500';
                                                } else if (optIdx === item.selectedOption && !item.correct) {
                                                    optStyle = 'border-red-500/30 bg-red-500/5 text-red-500';
                                                }

                                                return (
                                                    <div key={optIdx} className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${optStyle}`}>
                                                        <span>{opt}</span>
                                                        {optIdx === item.correctIndex && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                        {optIdx === item.selectedOption && optIdx !== item.correctIndex && <XCircle className="w-4 h-4 text-red-500" />}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="bg-white/[0.03] border-l-4 border-amber-500 p-4 rounded-r-xl">
                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-2">Explanation</span>
                                            <p className="text-gray-400 text-sm leading-relaxed">{item.explanation}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 flex flex-col md:flex-row gap-4 justify-center">
                                {/* Remediation Button in Review (PRD §6.6) */}
                                {weaknesses.length > 0 && (
                                    <button
                                        onClick={handleFetchRemediation}
                                        disabled={remediationLoading}
                                        className="px-8 py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
                                    >
                                        {remediationLoading ? (
                                            <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</>
                                        ) : (
                                            <><BookOpen className="w-5 h-5" /> Get Remediation</>
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={() => setView('dashboard')}
                                    className="bg-amber-500 hover:bg-amber-600 text-black px-12 py-5 rounded-2xl font-black text-xl transition-all shadow-xl shadow-amber-500/20"
                                >
                                    Return to Dashboard
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const question = questions[currentQ];

    // --- QUIZ SESSION (full-screen) ---
    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col p-6 md:p-12">
            <div className="max-w-4xl mx-auto w-full flex-grow flex flex-col">
                {/* Header with Exit */}
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-500 text-black font-black px-4 py-1 rounded-lg text-sm">
                            Q {currentQ + 1} / {questions.length}
                        </div>
                        <div className="h-2 w-48 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-500 transition-all duration-500"
                                style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleExitRequest}
                        className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
                    >
                        <X className="w-4 h-4" /> Exit Quiz
                    </button>
                </div>

                {/* Question Card */}
                <div className="bg-[#111] border border-white/5 rounded-[3rem] p-8 md:p-12 shadow-2xl flex-grow flex flex-col justify-center">
                    <span className="text-amber-500 font-bold tracking-widest text-xs uppercase mb-4 block">
                        Diagnostic Loop • Question {currentQ + 1}
                    </span>

                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-12 leading-tight">
                        {question.question}
                    </h2>

                    <div className="grid gap-4 mb-12">
                        {question.options.map((opt: string, idx: number) => {
                            let style = "bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10 hover:bg-white/[0.04]";
                            if (feedback) {
                                if (idx === feedback.correct_index) {
                                    style = "bg-green-500/10 border-green-500/50 text-green-500";
                                } else if (idx === selected && idx !== feedback.correct_index) {
                                    style = "bg-red-500/10 border-red-500/50 text-red-500";
                                } else {
                                    style = "bg-white/[0.01] border-white/5 text-gray-600 opacity-50";
                                }
                            } else if (selected === idx) {
                                style = "border-amber-500 bg-amber-500/5 text-white";
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => !feedback && setSelected(idx)}
                                    disabled={!!feedback}
                                    className={`w-full text-left p-6 rounded-2xl border transition-all flex items-center justify-between group ${style}`}
                                >
                                    <span className="font-medium">{opt}</span>
                                    {feedback && idx === feedback.correct_index && <CheckCircle className="w-5 h-5" />}
                                    {feedback && idx === selected && idx !== feedback.correct_index && <XCircle className="w-5 h-5" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Immediate Feedback */}
                    {feedback && (
                        <div className="animate-in slide-in-from-bottom-4">
                            <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl mb-8">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-amber-500 text-xs font-black uppercase tracking-widest">
                                        <AlertCircle className="w-4 h-4" /> Mastery Insight
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {feedback.gap_type && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${feedback.gap_type.toLowerCase() === 'application' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-blue-500/20 text-blue-500 border border-blue-500/30'}`}>
                                                {feedback.gap_type}
                                            </span>
                                        )}
                                        {/* Flag Button (PRD §12.3) — inline on feedback card */}
                                        <button
                                            onClick={() => setFlaggingIndex(currentQ)}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 text-gray-600 hover:text-red-500 transition-all"
                                            title="Report this question"
                                        >
                                            <Flag className="w-3 h-3" /> Report
                                        </button>
                                    </div>
                                </div>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    {feedback.explanation}
                                </p>
                            </div>
                            <button
                                onClick={handleNext}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-black py-5 rounded-2xl font-black text-lg transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3"
                            >
                                {currentQ === questions.length - 1 ? 'Finish Assessment' : 'Next Question'}
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* Submit button (before feedback) */}
                    {!feedback && (
                        <div className="flex justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={selected === null}
                                className="bg-white text-black px-8 py-3 rounded-lg font-bold disabled:opacity-50 transition-all hover:bg-gray-200"
                            >
                                Submit Answer
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Exit Warning Modal */}
            {showExitWarning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowExitWarning(false)} />
                    <div className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-[2rem] p-10 text-center animate-in slide-in-from-bottom-4 shadow-2xl">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-3">Exit Assessment?</h3>
                        <p className="text-gray-500 font-light leading-relaxed mb-8">
                            You will lose all progress on this quiz session. Your answers so far will not be saved. This action cannot be undone.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={confirmExit}
                                className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl font-black transition-all"
                            >
                                Yes, Exit Quiz
                            </button>
                            <button
                                onClick={() => setShowExitWarning(false)}
                                className="w-full bg-white/5 hover:bg-white/10 text-gray-400 py-4 rounded-xl font-bold transition-all"
                            >
                                Continue Assessment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Flag Question Modal (PRD §12.3) */}
            {flaggingIndex !== null && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => { setFlaggingIndex(null); setFlagNote(''); setFlagStatus('idle'); }} />
                    <div className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-[2rem] p-10 animate-in slide-in-from-bottom-4 shadow-2xl">
                        {flagStatus === 'sent' ? (
                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                                    <CheckCircle className="w-8 h-8 text-green-500" />
                                </div>
                                <h3 className="text-2xl font-black text-white mb-3">Report Logged</h3>
                                <p className="text-gray-500 font-light">Thank you. This question has been flagged for review.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
                                        <Flag className="w-5 h-5 text-red-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white">Report Question</h3>
                                        <p className="text-gray-600 text-xs">Help us improve quiz quality</p>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    {[
                                        { type: 'hallucination', label: 'Hallucinated / Not in source', color: 'red' },
                                        { type: 'factual_error', label: 'Correct answer is wrong', color: 'amber' },
                                        { type: 'off-topic', label: 'Off-topic or irrelevant', color: 'blue' },
                                    ].map(({ type, label, color }) => (
                                        <button
                                            key={type}
                                            onClick={() => handleFlag(type)}
                                            disabled={flagStatus === 'sending'}
                                            className={`w-full p-4 rounded-xl border transition-all text-left flex items-center justify-between group bg-${color}-500/5 border-${color}-500/10 hover:border-${color}-500/30 text-gray-300 hover:text-white disabled:opacity-50`}
                                        >
                                            <span className="text-sm font-bold">{label}</span>
                                            {flagStatus === 'sending' ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    value={flagNote}
                                    onChange={(e) => setFlagNote(e.target.value)}
                                    placeholder="Optional: Add details about the issue..."
                                    className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-gray-700 focus:border-amber-500 outline-none transition-all resize-none h-20 mb-4"
                                />

                                <button
                                    onClick={() => { setFlaggingIndex(null); setFlagNote(''); setFlagStatus('idle'); }}
                                    className="w-full text-gray-600 hover:text-white text-xs font-black uppercase tracking-widest py-3 transition-colors"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .animate-in {
                    animation-duration: 400ms;
                    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
                    fill-mode: forwards;
                }
                .fade-in { animation-name: fade-in; }
                .slide-in-from-bottom-4 { animation-name: slide-in-from-bottom-4; }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-in-from-bottom-4 { from { transform: translateY(1rem); } to { transform: translateY(0); } }
            `}</style>
        </div>
    );
};