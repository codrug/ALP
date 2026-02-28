
import React from 'react';
import {
    Shield,
    RefreshCcw,
    Target,
    BookOpen,
    FileUp,
    Zap,
    Microscope,
    Lock,
    Users,
    Play
} from 'lucide-react';

// --- Hero Section ---
interface HeroProps {
    onSignupClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onSignupClick }) => (
    <section className="pt-48 pb-24 px-6 text-center from-black to-gray-900 bg-gradient-to-b">
        <div className="max-w-4xl mx-auto">
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-6 leading-tight text-white">
                Stop Studying<br />
                <span className="text-amber-500">Start Mastering</span>
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed font-light">
                The only platform that traps you in a learning loop until you're actually ready for your exam. No more false confidence.
            </p>

            <div className="flex flex-col items-center gap-6">
                <button onClick={onSignupClick} className="bg-amber-500 hover:bg-amber-600 text-black px-10 py-5 rounded-md font-bold text-lg transition-all shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transform hover:-translate-y-1">
                    Get Started for Free
                </button>
            </div>
        </div>
    </section>
);

// --- Exam Logos ---
export const ExamLogos: React.FC = () => (
    <section className="py-24 border-y border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-[10px] uppercase font-bold tracking-widest text-gray-600 mb-10">Built for high-stakes exams</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale transition-all hover:grayscale-0 duration-500">
                {['GATE', 'CAT', 'IIT-JEE', 'UPSC', 'NEET'].map((exam) => (
                    <span key={exam} className="text-2xl font-black tracking-tighter text-gray-200 hover:text-white transition-colors cursor-default">{exam}</span>
                ))}
            </div>
        </div>
    </section>
);

// --- Master Standard Section ---
export const MasterStandard: React.FC = () => (
    <section id="standard" className="py-32 px-6 bg-black">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20">
            <div>
                <h2 className="text-5xl font-extrabold tracking-tighter mb-8 leading-tight text-white">
                    The <span className="text-amber-500">Master</span> Standard
                </h2>
                <p className="text-gray-400 text-lg leading-relaxed font-light">
                    We replaced passive learning with active enforcement. Our platform is built on the rigorous principle that knowing "most" of the material isn't enough when your license is on the line.
                </p>
            </div>

            <div className="space-y-6">
                {[
                    { icon: <RefreshCcw />, title: 'Adaptive Mastery Loop', desc: 'Content adapts to your failures, forcing you to confront knowledge gaps until they disappear.' },
                    { icon: <Target />, title: '80% Score Threshold', desc: 'You don\'t move forward until you prove mastery. We enforce excellence over completion.' },
                    { icon: <BookOpen />, title: 'Source-Grounded Accuracy', desc: 'Every answer is cross-referenced with your textbooks, ensuring pedagogical integrity.' }
                ].map((item, idx) => (
                    <div key={idx} className="bg-white/[0.03] border border-white/10 p-6 rounded-xl flex gap-6 group hover:border-amber-500/50 transition-all hover:bg-white/[0.05]">
                        <div className="text-amber-500 pt-1 group-hover:scale-110 transition-transform duration-300">
                            {item.icon}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-2 text-white">{item.title}</h3>
                            <p className="text-gray-500 text-sm font-light leading-relaxed">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </section>
);

// --- Mastery Loop Visualiser ---
export const MasteryLoop: React.FC = () => (
    <section id="loop" className="py-32 px-6 bg-black relative overflow-hidden">
        <div className="max-w-7xl mx-auto text-center mb-20 relative z-10">
            <h2 className="text-5xl font-extrabold tracking-tighter mb-6 text-white">The 5-Step Mastery Loop</h2>
            <p className="text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
                The rigorous process that transforms candidates into experts.
            </p>
        </div>

        <div className="max-w-4xl mx-auto relative pt-10 pb-10 z-10">
            {/* Central Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2 hidden md:block" />

            {[
                { step: '01', title: 'Upload Source', desc: 'Upload your notes. Our AI analyzes the material to build a unique knowledge graph specifically for your exam board requirements.', icon: <FileUp />, label: 'INITIATION' },
                { step: '02', title: 'Adaptive Quiz', desc: 'Engage with diagnostic questions that mirror actual exam difficulty. The system probes your understanding across all modules to find where you are strongest and weakest.', icon: <Zap />, label: 'BASELINE' },
                { step: '03', title: 'Gap Diagnosis', desc: 'Receive a detailed heat map of your knowledge. We identify the exact "micro-gaps" that would prevent you from hitting the 80% mastery threshold.', icon: <Microscope />, label: 'ANALYSIS' },
                { step: '04', title: 'Remediation', desc: 'Our system generates hyper-focused review sessions. You only study the specific concepts you missed until the logic is second nature.', icon: <RefreshCcw />, label: 'CORRECTION' },
                { step: '05', title: 'Reassessment', desc: 'Prove mastery. If you score above 80%, the next module unlocks. If not, the loop continues. We ensure 100% confidence before you step into the exam room.', icon: <Lock />, label: 'VALIDATION' }
            ].map((item, idx) => (
                <div key={idx} className={`flex items-center gap-12 md:gap-0 mb-16 relative ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                    {/* Label (Desktop Only) */}
                    <div className="hidden md:flex flex-1 justify-center">
                        <span className="text-[10px] font-bold tracking-[0.3em] text-gray-700 group-hover:text-amber-500 transition-colors">{item.label}</span>
                    </div>

                    {/* Node */}
                    <div className="relative z-10 w-12 h-12 bg-[#1a1a1a] border border-white/10 rounded-lg flex items-center justify-center text-amber-500 shadow-xl group hover:border-amber-500 transition-all duration-300 transform hover:scale-110">
                        {item.icon}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 ${idx % 2 === 0 ? 'md:pl-12' : 'md:pr-12 text-right'}`}>
                        <span className="text-[10px] font-extrabold tracking-widest text-amber-500 mb-2 block">STEP {item.step}</span>
                        <h3 className="text-2xl font-extrabold mb-4 text-white">{item.title}</h3>
                        <p className="text-gray-500 text-sm font-light leading-relaxed">{item.desc}</p>
                    </div>
                </div>
            ))}
        </div>
    </section>
);

// --- Feature Pillars ---
export const FeaturePillars: React.FC = () => (
    <section className="py-32 px-6 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
            {[
                { title: 'Source-Grounded', desc: 'No AI hallucinations. Every quiz question and explanation is strictly linked to your verified course materials.', icon: <Shield />, tag: 'SCIENTIFIC PRECISION' },
                { title: 'Exam-Aligned', desc: 'Assessments are built to mimic the difficulty, structure, and constraints of high-stakes licensing exams.', icon: <Target />, tag: 'BOARD APPROVED' },
                { title: 'Human-Validated', desc: 'Our core algorithm is constantly reviewed by subject matter experts to ensure pedagogical integrity.', icon: <Users />, tag: 'EXPERT VERIFIED' }
            ].map((item, idx) => (
                <div key={idx} className="bg-[#111] border border-white/5 p-10 rounded-xl hover:border-amber-500/30 transition-all flex flex-col h-full hover:bg-zinc-900 duration-300">
                    <div className="text-amber-500 mb-6 group-hover:scale-110 transition-transform">
                        {item.icon}
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-white">{item.title}</h3>
                    <p className="text-gray-500 text-sm font-light leading-relaxed mb-10 flex-grow">
                        {item.desc}
                    </p>
                    <div className="text-[10px] font-bold tracking-widest text-gray-700 uppercase group-hover:text-amber-500 transition-colors">{item.tag}</div>
                </div>
            ))}
        </div>
    </section>
);

// --- The 80% Rule ---
export const The80PercentRule: React.FC = () => (
    <section className="py-32 px-6 bg-black">
        <div className="max-w-7xl mx-auto bg-white/[0.02] border border-white/5 rounded-3xl p-12 md:p-24 flex flex-col md:flex-row items-center gap-20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-amber-500/5 blur-[120px] rounded-full translate-x-1/2" />

            <div className="flex-1 relative z-10">
                <h2 className="text-5xl font-extrabold tracking-tighter mb-8 leading-tight text-white">The 80% Rule</h2>
                <p className="text-gray-400 text-lg leading-relaxed font-light mb-10">
                    At Master, we don't believe in "passing." We believe in knowing. Our system locks the next set of content until you demonstrate an 80% proficiency on your current module.
                </p>
                <ul className="space-y-4">
                    {[
                        'Reduces exam-day anxiety',
                        'Ensures long-term retention',
                        'Eliminates study "drift"'
                    ].map((feat, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                            {feat}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="flex-1 flex justify-center items-center relative z-10">
                <div className="relative w-80 h-80 flex items-center justify-center group">
                    {/* Decorative Outer Ring */}
                    <div className="absolute w-[320px] h-[320px] rounded-full border border-white/5" />
                    <div className="absolute w-[280px] h-[280px] rounded-full border border-white/[0.02]" />

                    {/* Progress Ring Container */}
                    <div className="absolute w-full h-full flex items-center justify-center">
                        <svg viewBox="0 0 320 320" className="w-full h-full -rotate-90">
                            {/* Background Track */}
                            <circle
                                cx="160"
                                cy="160"
                                r="140"
                                fill="transparent"
                                stroke="rgba(251, 191, 36, 0.05)"
                                strokeWidth="4"
                            />
                            {/* 80% Progress Fill */}
                            <circle
                                cx="160"
                                cy="160"
                                r="140"
                                fill="transparent"
                                stroke="#fbbf24"
                                strokeWidth="6"
                                strokeDasharray="880"
                                strokeDashoffset="176"
                                strokeLinecap="round"
                                className="transition-all duration-[2000ms] ease-out drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]"
                            />
                        </svg>
                    </div>

                    <div className="relative z-10 flex flex-col items-center justify-center text-center -translate-y-4">
                        <span className="text-7xl font-black tracking-tighter mb-1 text-white drop-shadow-lg">80%</span>
                        <span className="text-[10px] font-bold tracking-[0.3em] text-gray-500 uppercase">Proficiency</span>
                    </div>

                    {/* Threshold Badge */}
                    <div className="absolute bottom-[80px] left-1/2 -translate-x-1/2 bg-amber-500 text-black px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-lg shadow-amber-500/20 whitespace-nowrap animate-pulse">
                        THRESHOLD MET
                    </div>
                </div>
            </div>
        </div>
    </section>
);

// --- CTA Section ---
interface CTASectionProps {
    onSignupClick: () => void;
}

export const CTASection: React.FC<CTASectionProps> = ({ onSignupClick }) => (
    <section className="py-48 px-6 text-center bg-black">
        <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-8 leading-tight text-white">
                Don’t leave your results to chance.<br />
                Master your syllabus today.
            </h2>
            <p className="text-xl text-gray-500 font-light mb-12">
                Join thousands of students who stopped guessing and started knowing.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <button onClick={onSignupClick} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-black px-10 py-5 rounded-md font-bold text-lg transition-all shadow-lg hover:shadow-amber-500/20 transform hover:-translate-y-1">
                    Start Your Mastery Journey
                </button>
                <button className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white px-10 py-5 rounded-md font-bold text-lg border border-white/10 transition-all flex items-center justify-center gap-2 hover:border-white/30">
                    <Play className="w-5 h-5 fill-current" /> View Demo
                </button>
            </div>
        </div>
    </section>
);
