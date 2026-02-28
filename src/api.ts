import { auth } from './firebase';

// Allow environment variable override, default to localhost:8000
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// --- Types ---

export interface UploadResponse {
    file_id: string;
    duplicate: boolean;
    status?: string;
}

export interface ParseResponse {
    file_id: string;
    status: string;
    chapters: any[]; // You can refine this type if needed
}

export interface ChapterDto {
    id: string;
    title: string;
    concepts: string[];
    selected: boolean;
}

export interface CurriculumItemDto {
    id: string;
    fileName: string;
    subject: string;
    topic: string;
    exam: string;
    date: string;
    status: 'Active' | 'Inactive' | 'Processing';
    chapters: ChapterDto[];
}

export interface CurriculumUpdatePayload {
    subject?: string;
    topic?: string;
    exam?: string;
    status?: 'Active' | 'Inactive' | 'Processing';
    chapters?: { id: string; title?: string; selected?: boolean }[];
}

export interface DashboardSummaryDto {
    readiness: number;
    riskChapters: { name: string; score: number }[];
    trend: number[];
    nextAction: string;
    hasContent: boolean; // [NEW] Added to match backend response
}

// --- Helper: Get User ID ---

const getUserId = (): string => {
    const user = auth.currentUser;
    if (!user) {
        // For debugging/dev, you might want to throw a clearer error
        // or redirect to login. For now, throw Error to stop the request.
        throw new Error("User not authenticated. Please log in.");
    }
    return user.uid;
};

// --- API Functions ---

/**
 * Upload a document with metadata and USER ID.
 */
export async function uploadDocument(params: {
    file: File;
    subject: string;
    topic: string;
    exam: string;
}): Promise<UploadResponse> {
    const userId = getUserId();

    const form = new FormData();
    form.append('file', params.file);
    form.append('subject', params.subject);
    form.append('topic', params.topic);
    form.append('exam', params.exam);
    form.append('user_id', userId); // [NEW] Send User ID

    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: form
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.detail || 'Upload failed.');
        }

        return response.json();
    } catch (err: any) {
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
            throw new Error(`Connection to AI Engine (${API_BASE_URL}) failed. Is the AI service running?`);
        }
        throw err;
    }
}

/**
 * Trigger parsing for a specific document.
 * (This works by Doc ID, so User ID is implicitly handled by backend ownership check if implemented, 
 * but standard practice is usually to verify ownership. For MVP, Doc ID is sufficient.)
 */
export async function parseDocument(fileId: string): Promise<ParseResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/documents/${fileId}/parse`, {
            method: 'POST'
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.detail || 'Parsing failed.');
        }

        return response.json();
    } catch (err: any) {
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
            throw new Error(`Connection to AI Engine (${API_BASE_URL}) failed. Is the AI service running?`);
        }
        throw err;
    }
}

/**
 * List documents belonging to the CURRENT USER.
 */
export async function listDocuments(): Promise<CurriculumItemDto[]> {
    const userId = getUserId();
    // [NEW] Pass user_id as query param
    try {
        const response = await fetch(`${API_BASE_URL}/documents?user_id=${userId}`);

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.detail || 'Failed to load documents.');
        }

        const payload = await response.json();
        return payload.items || [];
    } catch (err: any) {
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
            throw new Error(`Connection to AI Engine (${API_BASE_URL}) failed. Is the AI service running?`);
        }
        throw err;
    }
}

/**
 * Update document metadata or chapters.
 */
export async function updateDocument(docId: string, payload: CurriculumUpdatePayload): Promise<CurriculumItemDto> {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to update document.');
    }

    return response.json();
}

/**
 * Delete a document.
 */
export async function deleteDocument(docId: string): Promise<{ status: string; id: string }> {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to delete document.');
    }

    return response.json();
}

/**
 * Fetch Dashboard Summary for the CURRENT USER.
 */
export async function fetchDashboardSummary(): Promise<DashboardSummaryDto> {
    const userId = getUserId();
    // [NEW] Pass user_id as query param
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/summary?user_id=${userId}`);

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.detail || 'Failed to load dashboard.');
        }

        return response.json();
    } catch (err: any) {
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
            throw new Error(`Connection to AI Engine (${API_BASE_URL}) failed. Is the AI service running?`);
        }
        throw err;
    }
}