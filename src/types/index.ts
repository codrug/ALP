
export interface Chapter {
    id: string;
    title: string;
    concepts: string[];
    selected: boolean;
}

export interface CurriculumItem {
    id: string;
    fileName: string;
    subject: string;
    topic: string;
    date: string;
    status: 'Active' | 'Inactive' | 'Processing';
    chapters: Chapter[];
}
