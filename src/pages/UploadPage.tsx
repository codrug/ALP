
import React, { useState } from 'react';
import {
    Book,
    Upload,
    Plus,
    Lock,
    FileUp,
    Microscope,
    CheckCircle2,
    X,
    ChevronRight,
    Edit3,
    Info
} from 'lucide-react';
import { Chapter } from '../types';
import { parseDocument, uploadDocument } from '../api';

const UploadPage: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [step, setStep] = useState<'details' | 'uploading' | 'parsing' | 'review'>('details');
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState<string | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Form State
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const subjects = ['Computer Networks', 'Operating Systems', 'Data Structures'];

    // Simulation Logic
    const startProcess = async (file: File) => {
        setError(null);
        setStatusMessage(null);

        const validExtensions = ['pdf', 'docx'];
        const fileExt = file.name.split('.').pop()?.toLowerCase();

        if (!fileExt || !validExtensions.includes(fileExt)) {
            setError('Only PDF and DOCX files are supported.'
            );
            return;
        }

        try {
            setFileName(file.name);
            setStep('uploading');
            setProgress(20);

            const uploadResult = await uploadDocument({
                file,
                subject,
                topic,
                exam: 'GATE'
            });

            setProgress(100);
            if (uploadResult.duplicate) {
                setStatusMessage('Duplicate detected. Using existing file record.');
            }

            setStep('parsing');
            setProgress(20);
            const parseResult = await parseDocument(uploadResult.file_id);
            setProgress(100);
            setChapters(parseResult.chapters || []);
            setStep('review');
        } catch (err: any) {
            setError(err.message || 'Upload failed.');
            setStep('details');
            setProgress(0);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            startProcess(e.target.files[0]);
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            startProcess(e.dataTransfer.files[0]);
        }
    };

    const toggleChapter = (id: string) => {
        setChapters(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
    };

    const updateChapterTitle = (id: string, newTitle: string) => {
        setChapters(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    };

    const handleComplete = () => {
        if (!fileName) return;
        onComplete();
    };

    const isFormValid = subject.trim() !== '' && topic.trim() !== '';

    // Render Helpers
    const renderProgressBar = (color: string) => (
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
            <div
                className={`h-full ${color} transition-all duration-300 ease-out`}
                style={{ width: `${progress}%` }}
            />
        </div>
    );

    return (
        <div className="pt-28 pb-24 px-6 max-w-4xl mx-auto">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-white">
                    Upload <span className="text-amber-500">Curriculum</span>
                </h1>
                <p className="text-gray-500 font-light max-w-xl mx-auto leading-relaxed">
                    Provide context and upload your material. Our AI enforces unit-wise isolation for precision assessment.
                </p>
            </div>

            <div className="bg-[#111] border border-white/5 rounded-3xl p-1 md:p-10 min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden transition-all">

                {step === 'details' && (
                    <div className="w-full max-w-lg animate-in fade-in py-10 px-6">
                        <div className="mb-12 text-center">
                            <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-amber-500/20">
                                <Book className="w-10 h-10 text-amber-500" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Unit Guardrails</h3>
                            <p className="text-gray-500 text-sm">Targeted GATE material for exam-aligned benchmarks.</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-3 block">Subject Domain</label>
                                <select
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full bg-black/60 border border-white/10 rounded-2xl p-5 text-sm focus:border-amber-500 outline-none transition-all text-white"
                                >
                                    <option value="" disabled>Select GATE subject</option>
                                    {subjects.map((item) => (
                                        <option key={item} value={item}>{item}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-3 block">Topic / Unit Target</label>
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g. TCP Congestion Control"
                                    className="w-full bg-black/60 border border-white/10 rounded-2xl p-5 text-sm focus:border-amber-500 outline-none transition-all text-white placeholder:text-gray-700"
                                />
                            </div>
                        </div>

                        <div
                            onDragOver={(e) => { e.preventDefault(); if (isFormValid) setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={onDrop}
                            className={`mt-12 p-12 border-2 border-dashed rounded-3xl text-center transition-all ${isFormValid ? (isDragging ? 'border-amber-500 bg-amber-500/10' : 'border-amber-500/30 bg-amber-500/5 group hover:border-amber-500') : 'border-white/5 bg-white/[0.01] opacity-50 cursor-not-allowed'}`}
                        >
                            {!isFormValid ? (
                                <div className="flex flex-col items-center">
                                    <Lock className="w-12 h-12 text-gray-800 mb-6" />
                                    <p className="text-gray-700 text-sm font-bold tracking-tight">Complete guardrail details to unlock upload</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <Upload className={`w-12 h-12 text-amber-500 mb-8 transition-transform ${isDragging ? 'scale-110' : 'group-hover:scale-110'}`} />
                                    <h4 className="font-bold text-white mb-2">{isDragging ? 'Drop Manifest Here' : 'Ready to Synchronize'}</h4>
                                    <p className="text-gray-500 text-xs mb-10">Drag & Drop PDF or DOCX curriculum here</p>
                                    <label className="bg-amber-500 hover:bg-amber-600 text-black px-10 py-5 rounded-2xl font-black text-base transition-all cursor-pointer shadow-xl shadow-amber-500/10 inline-flex items-center gap-3 active:scale-95">
                                        <Plus className="w-5 h-5" />
                                        Add Source File
                                        <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.docx" />
                                    </label>
                                </div>
                            )}
                        </div>
                        <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-4 text-[10px] font-black text-gray-700 tracking-[0.2em] uppercase">
                            <span className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-900/60" /> PDF Curriculum</span>
                            <span className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-900/60" /> DOCX Records</span>
                            <span className="flex items-center gap-2 text-red-900/40"><X className="w-3.5 h-3.5" /> No Image Media</span>
                        </div>
                        {error && (
                            <div className="mt-6 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {(step === 'uploading' || step === 'parsing') && (
                    <div className="w-full max-w-sm text-center animate-in fade-in py-12">
                        <div className="relative w-36 h-36 mx-auto mb-12 flex items-center justify-center">
                            <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle
                                    cx="72" cy="72" r="68"
                                    fill="transparent"
                                    stroke="#fbbf24"
                                    strokeWidth="8"
                                    strokeDasharray="427"
                                    strokeDashoffset={427 - (427 * progress / 100)}
                                    strokeLinecap="round"
                                    className="transition-all duration-300 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                                />
                            </svg>
                            {step === 'uploading' ? (
                                <FileUp className="w-16 h-16 text-amber-500 animate-bounce" />
                            ) : (
                                <Microscope className="w-16 h-16 text-amber-500 animate-pulse" />
                            )}
                        </div>
                        <h3 className="text-3xl font-black mb-4 text-white">
                            {step === 'uploading' ? 'Ingesting Assets...' : 'Analyzing Knowledge Graph...'}
                        </h3>
                        <p className="text-gray-500 text-sm font-light mb-10 italic max-w-xs mx-auto">
                            "{fileName}" is being securely isolated and parsed.
                        </p>
                        {statusMessage && (
                            <p className="text-[10px] font-black text-amber-500 tracking-[0.2em] uppercase mb-6">{statusMessage}</p>
                        )}
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-3">
                            <div className="h-full bg-amber-500 transition-all duration-300 shadow-[0_0_15px_rgba(251,191,36,0.5)]" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-amber-500 tracking-[0.3em] uppercase">{Math.round(progress)}% SYNCHRONIZED</span>
                    </div>
                )}

                {step === 'review' && (
                    <div className="w-full animate-in slide-in-from-bottom-4 py-8 px-6 md:px-12">
                        <div className="flex flex-col md:flex-row items-center justify-between mb-12 pb-10 border-b border-white/5 gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-3xl flex items-center justify-center border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.05)]">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white">Curriculum processed successfully
                                    </h3>
                                    <p className="text-gray-500 text-sm font-light italic">
                                        Unit Mapping: <span className="text-amber-500 font-bold">{subject}</span> / <span className="text-white font-bold">{topic}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setStep('details');
                                    setFileName(null);
                                    setChapters([]);
                                    setStatusMessage(null);
                                    setError(null);
                                }}
                                className="flex items-center gap-2 text-[10px] font-black text-gray-600 hover:text-white transition-colors uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl border border-white/5 ring-1 ring-white/5 hover:bg-white/10"
                            >
                                <X className="w-3.5 h-3.5" /> Start Over
                            </button>
                        </div>

                        <div className="space-y-6 mb-12 max-h-[380px] overflow-y-auto pr-4 scrollbar-thin">
                            <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#111] py-2 z-10 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <Info className="w-4 h-4 text-amber-500/50" />
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Verify and Edit Parsed Topic Names</p>
                                </div>
                                <span className="text-[10px] font-bold text-gray-800 italic uppercase">User-isolated curriculum</span>
                            </div>

                            {chapters.map((chapter) => (
                                <div
                                    key={chapter.id}
                                    className={`p-6 rounded-3xl border transition-all flex items-start gap-6 group ${chapter.selected ? 'bg-amber-500/[0.03] border-amber-500/30' : 'bg-white/[0.01] border-white/5 opacity-60'}`}
                                >
                                    <div
                                        onClick={() => toggleChapter(chapter.id)}
                                        className={`mt-1 shrink-0 w-7 h-7 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${chapter.selected ? 'bg-amber-500 border-amber-500 shadow-xl shadow-amber-500/20' : 'border-white/10 hover:border-white/20'}`}
                                    >
                                        {chapter.selected && <CheckCircle2 className="w-5 h-5 text-black" />}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex items-center gap-3 mb-4 group-hover:translate-x-1 transition-transform">
                                            <div className="relative w-full">
                                                <input
                                                    type="text"
                                                    value={chapter.title}
                                                    onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                                                    className={`bg-transparent border-none p-0 focus:ring-0 text-lg font-black w-full transition-colors ${chapter.selected ? 'text-white' : 'text-gray-700'}`}
                                                />
                                                <div className={`absolute -bottom-1 left-0 h-px transition-all ${chapter.selected ? 'bg-amber-500/40 w-full' : 'bg-transparent w-0'}`} />
                                            </div>
                                            <Edit3 className={`w-4 h-4 shrink-0 text-gray-600 transition-opacity ${chapter.selected ? 'opacity-50' : 'opacity-0'}`} />
                                        </div>
                                        <div className="flex flex-wrap gap-2.5">
                                            {chapter.concepts.map((concept, idx) => (
                                                <span key={idx} className="text-[10px] font-bold px-3 py-1.5 bg-white/[0.02] text-gray-600 rounded-xl border border-white/5 tracking-tight">
                                                    {concept}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-6">
                            <button
                                onClick={() => setStep('details')}
                                className="flex-1 py-5 text-sm font-black text-gray-600 hover:text-white transition-colors uppercase tracking-widest bg-white/[0.02] rounded-[2rem] hover:bg-white/5"
                            >
                                Discard Ingestion
                            </button>
                            <button
                                onClick={handleComplete}
                                className="flex-[2] bg-amber-500 hover:bg-amber-600 text-black py-6 rounded-[2rem] font-black text-xl transition-all shadow-2xl shadow-amber-500/20 flex items-center justify-center gap-4 group active:scale-95"
                            >
                                Initialize Assessments
                                <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                            </button>
                        </div>
                    </div>
                )}
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
        
        /* Custom scrollbar for review section */
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: rgba(251, 191, 36, 0.5);
        }
      `}</style>
        </div>
    );
};

export default UploadPage;
