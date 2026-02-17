export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface UploadResponse {
    file_id: string;
    duplicate: boolean;
}

export interface ParseResponse {
    file_id: string;
    status: string;
    chapters: ChapterDto[];
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
}

export async function uploadDocument(params: {
    file: File;
    subject: string;
    topic: string;
    exam: string;
}): Promise<UploadResponse> {
    const form = new FormData();
    form.append('file', params.file);
    form.append('subject', params.subject);
    form.append('topic', params.topic);
    form.append('exam', params.exam);

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: form
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Upload failed.');
    }

    return response.json();
}

export async function parseDocument(fileId: string): Promise<ParseResponse> {
    const response = await fetch(`${API_BASE_URL}/documents/${fileId}/parse`, {
        method: 'POST'
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Parsing failed.');
    }

    return response.json();
}

export async function listDocuments(): Promise<CurriculumItemDto[]> {
    const response = await fetch(`${API_BASE_URL}/documents`);

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Failed to load documents.');
    }

    const payload = await response.json();
    return payload.items || [];
}

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

export async function fetchDashboardSummary(): Promise<DashboardSummaryDto> {
    const response = await fetch(`${API_BASE_URL}/dashboard/summary`);

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Failed to load dashboard.');
    }

    return response.json();
}
