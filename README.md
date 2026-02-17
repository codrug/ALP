# ALP (Master Learning Platform)

React + Vite frontend, Node.js API, and FastAPI AI service for curriculum ingestion.

## Quick Start

```bash
npm install
npm install --prefix server
npm run dev
```

## Ports

- Frontend: http://localhost:3000
- Node API: http://localhost:3001
- AI API: http://localhost:8001

## Environment

Root `.env`:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `GEMINI_API_KEY`

Root `.env.local` (optional):
- `VITE_API_BASE_URL` (default: `http://localhost:8001`)

## Project Structure

```
.
├─ src/              # Frontend app
├─ server/           # Node API
├─ ai-engine/        # FastAPI AI service
├─ App.tsx
├─ index.tsx
├─ vite.config.ts
└─ package.json
```

## Notes for Collaborators

- Runtime AI data under `ai-engine/data/` is ignored.
- Keep shared secrets in `.env`, personal overrides in `.env.local`.
- If you change AI port, update both `.env.local` and `npm run dev:ai`.