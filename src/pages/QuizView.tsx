import React, { useState, useEffect } from 'react';
import { ArrowRight, AlertCircle, CheckCircle, XCircle, Loader2, Trophy, BookOpen, RefreshCw } from 'lucide-react';
import { API_BASE_URL, getRemediation } from '../api';

interface QuizViewProps {
    docId: string | null;
    setView: (v: 'dashboard' | 'upload') => void;
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
    const [isFinished, setIsFinished] = useState(false);

    const [remediation, setRemediation] = useState<string | null>(null);
    const [loadingRemediation, setLoadingRemediation] = useState(false);
    const [showRemedy, setShowRemedy] = useState(false);

    const startQuiz = async () => {
        if (!docId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/quiz/generate/${docId}`, { method: 'POST' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to generate quiz");
            }
            const data = await res.json();
            setQuestions(data.questions);
            setQuizId(data.quiz_id);
            setLoading(false);
        } catch (err: any) {
            console.error("Failed to start quiz", err);
            setError(err.message || "Failed to start diagnostic loop. The AI engine might be busy.");
            setLoading(false);
        }
    };

    useEffect(() => {
        startQuiz();
    }, [docId]);

    const handleSubmit = async () => {
        if (!quizId || selected === null) return;

        const res = await fetch(`${API_BASE_URL}/quiz/${quizId}/submit?question_index=${currentQ}&selected_option=${selected}`, {
            method: 'POST'
        });
        const data = await res.json();
        setFeedback(data);

        if (data.correct) {
            setScore(prev => prev + 1);
        }
    };

    const handleNext = () => {
        if (currentQ < questions.length - 1) {
            setCurrentQ(prev => prev + 1);
            setSelected(null);
            setFeedback(null);
        } else {
            setIsFinished(true);
            fetchRemediation();
        }
    };

    const fetchRemediation = async () => {
        if (!quizId) return;
        setLoadingRemediation(true);
        try {
            const content = await getRemediation(quizId);
            setRemediation(content);
        } catch (err) {
            console.error("Remediation failed", err);
        } finally {
            setLoadingRemediation(false);
        }
    };

    if (isFinished) {
        const percentage = Math.round((score / questions.length) * 100);
        const isPassed = percentage >= 80;

        let criticalLevel = "Low";
        let criticalColor = "text-green-500";
        if (percentage < 50) {
            criticalLevel = "High";
            criticalColor = "text-red-500";
        } else if (percentage < 80) {
            criticalLevel = "Medium";
            criticalColor = "text-amber-500";
        }

        if (showRemedy) {
            return (
                <div className="min-h-screen pt-28 pb-20 px-6 max-w-4xl mx-auto flex flex-col">
                    <div className="bg-[#111] border border-amber-500/20 rounded-3xl p-10 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 flex flex-col min-h-[500px]">
                        <div className="flex flex-col flex-1">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/10 rounded-lg">
                                        <BookOpen className="w-6 h-6 text-amber-500" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Targeted Study Guide</h3>
                                </div>
                                <button onClick={() => setShowRemedy(false)} className="text-gray-400 hover:text-white transition-colors">
                                    View Score
                                </button>
                            </div>

                            <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-2xl p-8 mb-10">
                                {loadingRemediation ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-4">
                                        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                                        <p className="text-gray-500 text-sm font-bold">AI is synthesizing your gap analysis...</p>
                                    </div>
                                ) : remediation ? (
                                    <div className="prose prose-invert max-w-none">
                                        <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-lg">
                                            {remediation}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center">
                                        <p className="text-gray-500 italic text-center">No remediation data available.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row gap-4 mt-auto">
                            <button
                                onClick={() => {
                                    // Reset state for re-attempt
                                    setCurrentQ(0);
                                    setSelected(null);
                                    setFeedback(null);
                                    setScore(0);
                                    setIsFinished(false);
                                    setRemediation(null);
                                    setShowRemedy(false);
                                    startQuiz();
                                }}
                                className="flex-1 bg-amber-500 text-black font-black py-4 rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Attempt Again
                            </button>
                            <button
                                onClick={() => setView('dashboard')}
                                className="flex-1 bg-white/5 text-gray-400 font-bold py-4 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 border border-white/5"
                            >
                                <ArrowRight className="w-5 h-5" />
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen pt-28 pb-20 px-6 max-w-4xl mx-auto flex flex-col">
                <div className="bg-[#111] border border-white/10 rounded-3xl p-10 relative overflow-hidden">
                    <h2 className="text-3xl font-black text-white mb-8 uppercase tracking-tighter text-center">Results Dashboard</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
                            <span className="text-gray-400 font-bold mb-3 uppercase tracking-wider text-sm">Results</span>
                            <span className={`text-5xl font-black ${isPassed ? 'text-green-500' : 'text-amber-500'}`}>{percentage}%</span>
                            <span className="text-sm font-medium text-gray-500 mt-3">{score} out of {questions.length} correct</span>
                        </div>

                        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
                            <span className="text-gray-400 font-bold mb-3 uppercase tracking-wider text-sm">Status</span>
                            <span className={`text-2xl font-black ${isPassed ? 'text-green-500' : 'text-amber-500'}`}>
                                {isPassed ? "Mastery Achieved" : "Gap Detected"}
                            </span>
                        </div>

                        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
                            <span className="text-gray-400 font-bold mb-3 uppercase tracking-wider text-sm">Critical Level</span>
                            <span className={`text-3xl font-black ${criticalColor}`}>{criticalLevel}</span>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <button
                            onClick={() => setShowRemedy(true)}
                            className="flex-1 bg-amber-500 text-black font-black py-4 rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                        >
                            <BookOpen className="w-5 h-5" />
                            Remedy Guide
                        </button>
                        <button
                            onClick={() => setView('dashboard')}
                            className="flex-1 bg-white/5 text-gray-400 font-bold py-4 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 border border-white/5"
                        >
                            <ArrowRight className="w-5 h-5" />
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (error) return (
        <div className="min-h-screen pt-28 px-6 flex items-center justify-center">
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

    if (loading) return (
        <div className="min-h-screen pt-28 flex flex-col items-center justify-center text-white">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
            <h2 className="text-xl font-bold">Generating Diagnostic Loop...</h2>
        </div>
    );

    const question = questions[currentQ];

    return (
        <div className="min-h-screen pt-28 px-6 max-w-4xl mx-auto">
            <div className="w-full h-1 bg-white/10 rounded-full mb-12">
                <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                />
            </div>

            <div className="bg-[#111] border border-white/10 p-10 rounded-3xl relative overflow-hidden">
                <span className="text-amber-500 font-bold tracking-widest text-xs uppercase mb-4 block">
                    Diagnostic Loop • Question {currentQ + 1}
                </span>

                <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 leading-tight">
                    {question.question}
                </h2>

                <div className="space-y-4">
                    {question.options.map((opt: string, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => !feedback && setSelected(idx)}
                            disabled={!!feedback}
                            className={`w-full text-left p-6 rounded-xl border-2 transition-all font-medium text-lg flex justify-between items-center
                                ${feedback && idx === feedback.correct_index
                                    ? 'border-green-500 bg-green-500/10 text-green-500'
                                    : feedback && idx === selected && idx !== feedback.correct_index
                                        ? 'border-red-500 bg-red-500/10 text-red-500'
                                        : selected === idx
                                            ? 'border-amber-500 bg-amber-500/5 text-white'
                                            : 'border-white/5 bg-white/[0.02] text-gray-400 hover:bg-white/[0.05]'
                                }
                            `}
                        >
                            {opt}
                            {feedback && idx === feedback.correct_index && <CheckCircle className="w-6 h-6" />}
                            {feedback && idx === selected && idx !== feedback.correct_index && <XCircle className="w-6 h-6" />}
                        </button>
                    ))}
                </div>

                {feedback && (
                    <div className="mt-8 bg-white/5 border-l-4 border-amber-500 p-6 rounded-r-xl animate-in fade-in slide-in-from-bottom-4">
                        <h4 className="text-white font-bold mb-2 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            Explanation
                        </h4>
                        <p className="text-gray-400 leading-relaxed mb-2">
                            {feedback.explanation}
                        </p>
                    </div>
                )}

                <div className="mt-10 flex justify-end">
                    {!feedback ? (
                        <button
                            onClick={handleSubmit}
                            disabled={selected === null}
                            className="bg-white text-black px-8 py-3 rounded-lg font-bold disabled:opacity-50"
                        >
                            Submit Answer
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="bg-amber-500 text-black px-8 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-amber-400"
                        >
                            {currentQ === questions.length - 1 ? "Finish Loop" : "Next Concept"}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};