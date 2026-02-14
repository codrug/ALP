
import React, { useState, useMemo } from 'react';
import {
    BookOpen,
    FileText,
    Search,
    Eye,
    Archive,
    X,
    CheckCircle2
} from 'lucide-react';
import { CurriculumItem } from '../types';

interface CurriculumPageProps {
    items: CurriculumItem[];
}

const CurriculumPage: React.FC<CurriculumPageProps> = ({ items }) => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Processing'>('All');
    const [selectedItem, setSelectedItem] = useState<CurriculumItem | null>(null);

    const filteredData = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = item.fileName.toLowerCase().includes(search.toLowerCase()) ||
                item.subject.toLowerCase().includes(search.toLowerCase()) ||
                item.topic.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [search, statusFilter, items]);

    return (
        <div className="pt-28 pb-24 px-6 max-w-7xl mx-auto animate-in fade-in">
            <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-6">
                <div>
                    <h1 className="text-5xl font-black tracking-tighter text-white mb-2">Knowledge Inventory</h1>
                    <p className="text-gray-500 font-light">All synchronized assets isolated within your candidate environment.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-amber-500" />
                        <span className="text-xl font-black text-white">{items.length}</span>
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Total Sources</span>
                    </div>
                </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 p-4 md:p-6 rounded-[2rem] mb-10 flex flex-col md:flex-row gap-6">
                <div className="flex-grow relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                    <input
                        type="text"
                        placeholder="Search filenames, subjects, or topics..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm text-white focus:border-amber-500 outline-none transition-all placeholder:text-gray-700"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    {['All', 'Active', 'Inactive', 'Processing'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status as any)}
                            className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === status ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredData.map((item) => (
                    <div key={item.id} className="bg-[#111] border border-white/5 rounded-[2.5rem] p-8 flex flex-col shadow-xl hover:border-amber-500/20 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-5">
                            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${item.status === 'Active' ? 'text-green-500 bg-green-500' : (item.status === 'Processing' ? 'text-amber-500 bg-amber-500' : 'text-gray-700 bg-gray-700')}`} />
                        </div>

                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-amber-500/30 transition-colors">
                                <FileText className={`w-7 h-7 ${item.status === 'Active' ? 'text-amber-500' : 'text-gray-600'}`} />
                            </div>
                            <div className="flex-grow min-w-0">
                                <h3 className="font-black text-white truncate text-lg group-hover:text-amber-500 transition-colors">{item.fileName}</h3>
                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mt-1">{item.date}</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-8 flex-grow">
                            <div>
                                <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest block mb-1">Subject Domain</span>
                                <span className="text-sm text-gray-300 font-bold">{item.subject}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest block mb-1">Assessed Topic</span>
                                <span className="text-sm text-gray-300 font-bold">{item.topic}</span>
                            </div>
                            {item.chapters.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {item.chapters.slice(0, 2).map((c, i) => (
                                        <span key={i} className="text-[9px] font-black px-2 py-0.5 bg-white/5 text-gray-600 rounded-md border border-white/5">{c.title}</span>
                                    ))}
                                    {item.chapters.length > 2 && <span className="text-[9px] font-black px-2 py-0.5 bg-white/5 text-gray-600 rounded-md">+{item.chapters.length - 2} more</span>}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setSelectedItem(item)}
                                className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/5 py-4 rounded-2xl font-black text-xs transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                <Eye className="w-3.5 h-3.5" /> Details
                            </button>
                            <button className="p-4 bg-white/5 hover:bg-red-500/10 text-gray-600 hover:text-red-500 rounded-2xl transition-all border border-white/5">
                                <Archive className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredData.length === 0 && (
                <div className="py-32 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
                        <Search className="w-10 h-10 text-gray-700" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-600 mb-2">No Ingested Data Found</h3>
                    <p className="text-gray-700 font-light">Adjust your filters or initiate a new syllabus synchronization.</p>
                </div>
            )}

            {selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
                    <div className="relative w-full max-w-2xl bg-[#0d0d0d] border border-white/10 rounded-[3rem] p-10 animate-in slide-in-from-bottom-6 shadow-2xl overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.02] blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
                        <button onClick={() => setSelectedItem(null)} className="absolute top-8 right-8 text-gray-600 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-6 mb-10 relative z-10">
                            <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center border border-amber-500/20">
                                <FileText className="w-10 h-10 text-amber-500" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tighter">{selectedItem.fileName}</h2>
                                <p className="text-gray-500 text-sm mt-1">{selectedItem.subject} &bull; {selectedItem.topic}</p>
                            </div>
                        </div>

                        <div className="space-y-6 max-h-[400px] overflow-y-auto scrollbar-thin pr-4 relative z-10">
                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Extracted Knowledge Modules</p>
                            {selectedItem.chapters.length > 0 ? selectedItem.chapters.map(c => (
                                <div key={c.id} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-4">
                                    <div className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center ${c.selected ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' : 'border-white/10 text-gray-700'}`}>
                                        {c.selected ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className={`font-bold mb-3 ${c.selected ? 'text-white' : 'text-gray-600 italic line-through decoration-white/10'}`}>{c.title}</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {c.concepts.map((concept, i) => (
                                                <span key={i} className="text-[9px] font-black px-2.5 py-1 bg-black/40 text-gray-500 rounded-lg border border-white/5">{concept}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-gray-700 italic text-sm py-10 text-center">In-progress or zero metadata structural analysis.</p>
                            )}
                        </div>

                        <div className="mt-10 pt-8 border-t border-white/5 flex gap-4 relative z-10">
                            <button className="flex-1 bg-amber-500 hover:bg-amber-600 text-black py-5 rounded-2xl font-black transition-all">Enter Mastery Loop</button>
                            <button className="flex-1 bg-white/5 hover:bg-white/10 text-white py-5 rounded-2xl font-black transition-all">Audit Structure</button>
                        </div>
                    </div>
                </div>
            )}
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

export default CurriculumPage;
