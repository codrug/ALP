# Product Requirements Document (PRD): ALP (Adaptive Learning Platform)

## 1. Executive Summary
**ALP (Adaptive Learning Platform)** is an intelligent study assistant designed to help students, particularly those preparing for competitive exams like **GATE**, master their subjects through AI-driven insights. The platform allows users to upload study materials, identifies core concepts, and provides a continuous learning loop through personalized quizzes and gap diagnosis.

---

## 2. Problem Statement
Students often struggle to identify exact weaknesses within large syllabi. Traditional study methods lack immediate feedback on which specific concepts (Foundation vs. Application) are causing bottlenecks in their understanding.

---

## 3. Goals & Objectives
- **Automated Curriculum Extraction**: Convert static documents (PDF/DOCX) into interactive study modules.
- **Personalized Assessment**: Generate quizzes tailored to specific chapters or concepts using LLMs.
- **Gap Diagnosis**: Categorize user errors into "Foundation" (recall/facts) or "Application" (reasoning/logic) gaps.
- **Adaptive Guidance**: Recommend specific "Next Actions" based on a "Readiness Score."

---

## 4. Target Audience
- Secondary and Higher-Education students.
- Competitive exam aspirants (e.g., GATE).
- Lifelong learners seeking structured study paths.

---

## 5. Functional Requirements

### 5.1 User Authentication
- Secure login and registration using **Firebase Authentication**.
- User-specific data isolation (docs, quizzes, and analytics).

### 5.2 Document Management
- **Upload**: Support for PDF and DOCX files.
- **Parsing**: Automatic text extraction and "Chunking" into logical chapters/sections.
- **Concept Mapping**: Automatic identification of top 3-5 concepts per chapter.
- **Status Tracking**: Visual indicators for document processing (Processing, Active).

### 5.3 Learning & Assessment
- **AI Quiz Generation**: On-demand generation of MCQs based on document content using **Gemini AI**.
- **Instant Feedback**: Immediate correction after each question with detailed explanations.
- **Gap Tracking**: Tagging incorrect answers with their corresponding "Gap Type" (Foundation vs. Application).

### 5.4 Analytics Dashboard
- **Readiness Score**: A 0-100% metric representing the user's mastery level.
- **Risk Chapters**: Identification of chapters with the lowest performance.
- **Readiness Trend**: A visual historical trend of learning progress.
- **Dynamic Next Steps**: AI-suggested actions (e.g., "Attempt an application-level quiz").

---

## 6. Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend (Orchestration)** | Node.js, Express, Firebase Admin |
| **AI Engine (Intelligence)** | FastAPI, Python, Gemini 1.5 Flash |
| **Vector Database** | Qdrant (for semantic retrieval and chunking) |
| **Storage** | Local structured JSON storage (for metadata) and local file system (for uploads) |

---

## 7. User Flows

### 7.1 The Onboarding Flow
1. User creates account/logs in.
2. User lands on the Dashboard (initially empty).

### 7.2 The Learning Flow
1. User uploads a syllabus Doc (e.g., "Operating Systems").
2. AI Engine parses the doc into chapters.
3. User selects a chapter and starts a "Mastery Loop" (Quiz).
4. User completes the quiz; analytics update the Readiness Score.
5. Dashboard highlights "Risk Chapters" for focused revision.

---

## 8. Success Metrics
- **Mastery Speed**: Reduction in time taken to reach 80% readiness score.
- **Engagement**: Number of quizzes taken per document.
- **Accuracy Improvement**: Increase in "Application" level question accuracy over time.
