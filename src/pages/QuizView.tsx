import React, { useState, useEffect } from 'react';
import { ArrowRight, AlertCircle, CheckCircle, XCircle, Loader2, Trophy, UploadCloud, RefreshCw } from 'lucide-react';

interface QuizViewProps {
    docId: string | null;
    setView: (v: 'dashboard' | 'upload') => void; // Added 'upload' capability
}

export const QuizView: React.FC<QuizViewProps> = ({ docId, setView }) => {
    // Quiz State
    const [questions, setQuestions] = useState<any[]>([]);
    const [quizId, setQuizId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Interaction State
    const [currentQ, setCurrentQ] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<any>(null);
    const [score, setScore] = useState(0); // Track correct answers
    const [isFinished, setIsFinished] = useState(false);

    // 1. Generate Quiz
    useEffect(() => {
        if (!docId) return;
        const startQuiz = async () => {
            try {
                const res = await fetch(`http://localhost:8000/quiz/generate/${docId}`, { method: 'POST' });
                const data = await res.json();
                setQuestions(data.questions);
                setQuizId(data.quiz_id);
                setLoading(false);
            } catch (err) {
                console.error("Failed to start quiz", err);
            }
        };
        startQuiz();
    }, [docId]);

    // 2. Submit Answer
    const handleSubmit = async () => {
        if (!quizId || selected === null) return;

        const res = await fetch(`http://localhost:8000/quiz/${quizId}/submit?question_index=${currentQ}&selected_option=${selected}`, {
            method: 'POST'
        });
        const data = await res.json();
        setFeedback(data);

        if (data.correct) {
            setScore(prev => prev + 1);
        }
    };

    // 3. Next Question or Finish
    const handleNext = () => {
        if (currentQ < questions.length - 1) {
            setCurrentQ(prev => prev + 1);
            setSelected(null);
            setFeedback(null);
        } else {
            setIsFinished(true); // Trigger Result Screen
        }
    };

    // 4. Result Screen Logic
    if (isFinished) {
        const percentage = Math.round((score / questions.length) * 100);
        const isPassed = percentage >= 80;

        return (
            <div className="min-h-screen pt-28 px-6 flex items-center justify-center">
                <div className="max-w-xl w-full bg-[#111] border border-white/10 rounded-3xl p-10 text-center relative overflow-hidden">
                    {/* Background Glow */}
                    <div className={`absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 ${isPassed ? 'bg-green-500/10' : 'bg-amber-500/10'}`} />

                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isPassed ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                        {isPassed ? <Trophy className="w-10 h-10 text-green-500" /> : <RefreshCw className="w-10 h-10 text-amber-500" />}
                    </div>

                    <h2 className="text-4xl font-black text-white mb-2">{percentage}%</h2>
                    <h3 className="text-xl font-bold text-gray-300 mb-6">
                        {isPassed ? "Mastery Achieved!" : "Gap Detected"}
                    </h3>

                    <p className="text-gray-400 mb-10 leading-relaxed">
                        {isPassed
                            ? "You've demonstrated strong command of this topic. You can proceed to the next module or deepen your current knowledge."
                            : "We found some foundation gaps. The system has updated your dashboard with targeted remediation steps."}
                    </p>

                    <div className="space-y-4">
                        {/* High Score Options */}
                        {isPassed ? (
                            <>
                                <button
                                    onClick={() => setView('upload')}
                                    className="w-full bg-green-500 text-black font-bold py-4 rounded-xl hover:bg-green-400 transition-all flex items-center justify-center gap-2"
                                >
                                    <UploadCloud className="w-5 h-5" />
                                    Upload New Material
                                </button>
                                <button
                                    onClick={() => setView('dashboard')}
                                    className="w-full bg-white/5 text-gray-300 font-bold py-4 rounded-xl hover:bg-white/10 transition-all"
                                >
                                    Stay on Current Topic
                                </button>
                            </>
                        ) : (
                            /* Low Score Option */
                            <button
                                onClick={() => setView('dashboard')}
                                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                            >
                                <ArrowRight className="w-5 h-5" />
                                Return to Dashboard
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (loading) return (
        <div className="min-h-screen pt-28 flex flex-col items-center justify-center text-white">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
            <h2 className="text-xl font-bold">Generating Diagnostic Loop...</h2>
        </div>
    );

    const question = questions[currentQ];

    return (
        <div className="min-h-screen pt-28 px-6 max-w-4xl mx-auto">
             {/* Progress Bar */}
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

                {/* Immediate Feedback Card */}
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