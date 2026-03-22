<div align="center">
<h1>ALP: Adaptive Learning Platform</h1>

<p><strong>A sophisticated ecosystem for exam preparation featuring automated document parsing, semantic search, and personalized quiz generation.</strong></p>

[![License](https://img.shields.io/badge/License-Custom-blue.svg)](#license)
[![GitHub contributors](https://img.shields.io/github/contributors/codrug/ALP.svg)](https://github.com/codrug/ALP/graphs/contributors)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)

</div>

---

## Overview

The **Master Learning Platform (ALP)** is an advanced tool designed to streamline the learning process for competitive exams (like GATE). It transforms passive study materials into active learning assets using Generative AI.

ALP automatically parses your uploaded PDF, DOCX, and TXT notes, identifies core concepts, and indexes them into a vector database for semantic retrieval. It then generates personalized quizzes based on your specific study content, tracking your readiness and identifying areas of risk.

---

## Features

- **Smart Document Ingestion**: Automated extraction of text from PDF and DOCX files with intelligent chapter boundary detection.
- **Semantic Search & Indexing**: Uses **Qdrant** vector database and **Google Gemini** embeddings for context-aware retrieval.
- **Personalized Quiz Generation**: AI-driven creation of foundation, application, and conceptual questions tailored to your materials.
- **Readiness Dashboard**: Visual analytics tracking your subject mastery, trend analysis, and "at-risk" chapters.
- **Secure Authentication**: Integrated with **Firebase** for robust user management and data isolation.
- **Real-time Processing**: Fast concurrent execution of Frontend, AI Engine, and Node Server.

---

## Tech Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: Vanilla CSS / Tailwind (if applicable)
- **Icons**: Lucide React
- **Types**: TypeScript

### AI Engine (Backend)
- **Framework**: FastAPI
- **LLM**: Google Gemini (Vertex AI / Generative AI)
- **Vector DB**: Qdrant
- **Embeddings**: FastEmbed

### Storage & Auth
- **Database**: Firebase Admin / Firestore
- **Authentication**: Firebase Auth

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Gemini API Key
- Firebase Project Credentials

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/codrug/ALP.git
   cd ALP
   ```

2. **Setup AI Engine**:
   ```bash
   cd ai-engine
   # Windows
   py -3.11 -m venv venv
   .\venv\Scripts\activate
   # Linux/Mac
   python3 -m venv venv
   source venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Setup Node Server**:
   ```bash
   cd ../server
   npm install
   ```

4. **Setup Client**:
   ```bash
   cd ..
   npm install
   ```

### Configuration

Create a `.env` file in the root directory and add the following:

| Variable | Description |
|---|---|
| `GOOGLE_API_KEY` | Your Gemini API Key |
| `VITE_FIREBASE_*` | Firebase configuration keys |
| `QDRANT_URL` | Qdrant instance URL |
| `QDRANT_API_KEY` | Qdrant API Key |

---

## Usage

To run the entire ecosystem (Client, Server, and AI Engine) simultaneously:

```bash
npm run dev
```

Individual components can be started separately:
- **AI Engine**: `uvicorn main:app --reload --port 8000` (inside `ai-engine`)
- **Node Server**: `npm run dev` (inside `server`)
- **Vite Client**: `npx vite` (in root)

---

## Project Structure

```text
ALP/
├── ai-engine/        # FastAPI service for LLM & Vector DB
│   ├── routers/      # API endpoints (Quiz, Ingest)
│   ├── services/     # core logic (Gemini, Qdrant)
│   └── main.py          # Entry point
├── server/           # Node.js backend for Firebase admin
├── src/              # React frontend
│   ├── components/   # UI components
│   └── pages/        # Dashboard, Quiz, Upload views
├── data/             # Local storage for processed docs
└── package.json         # Orchestration scripts
```

---

## Collaborators

Special thanks to the developers who have contributed to ALP:

<div>
  <a href="https://github.com/Sumanth-kalla">
    <img src="https://github.com/Sumanth-kalla.png" width="100px;" alt="Sumanth-kalla"/>
  </a>
  <a href="https://github.com/prasanna25325">
    <img src="https://github.com/prasanna25325.png" width="100px;" alt="prasanna25325"/>
  </a>
  <a href="https://github.com/vendotha">
    <img src="https://github.com/vendotha.png" width="100px;" alt="vendotha"/>
  </a>
  <a href="https://github.com/codrug">
    <img src="https://github.com/codrug.png" width="100px;" alt="codrug"/>
  </a>
  <a href="https://github.com/satvikapatibandla2005-ai">
    <img src="https://github.com/satvikapatibandla2005-ai.png" width="100px;" alt="satvikapatibandla2005-ai"/>
  </a>
</div>

---

## License

Copyright (c) 2026. All Rights Reserved.

This code is for viewing purposes only. No part of this repository may be reproduced, distributed, or modified without prior written permission.
