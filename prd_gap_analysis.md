# PRD vs Codebase — Gap Analysis

Every step from the PRD is listed as a **one-liner**, followed by its implementation status and — where needed — a recommended fix.

| Legend | Meaning |
|--------|---------|
| ✅ | Implemented and meets PRD |
| ⚠️ | Implemented but below PRD standard |
| ❌ | Not implemented at all |

---

## §1 Product Overview — "Exam-first, closed-loop adaptive learning"

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 1.1 | Platform must measure *actual* understanding, not perceived understanding | ✅ | Quiz sessions now feed into an exam-weighted, chapter-level mastery model where Application gaps are penalized more heavily than Foundation gaps (via `gap_type`-weighted scoring) and chapters are weighted by exam importance (currently CN/OS). |
| 1.2 | Adapt learning based on diagnosed gaps | ⚠️ | [generate_remediation()](file:///d:/ALP/ai-engine/services/gemini.py#108-143) exists in [gemini.py](file:///d:/ALP/ai-engine/services/gemini.py) but is **never called** from any route or frontend. **Fix:** wire up a `/quiz/{quiz_id}/remediation` endpoint and show remediation cards after quiz results. |
| 1.3 | Remain strictly grounded in syllabus & exam patterns | ⚠️ | Quiz prompt says "based ONLY on the following text" — correct intent, but there is **no verifier LLM or rule-based check** to enforce grounding. **Fix:** add validation pipeline (see §12). |
| 1.4 | Learn from its own mistakes without learning incorrect content | ❌ | No error/hallucination logging exists. **Fix:** create an `error_log.json` or DB table; log any failed validations; use logs to refine prompts (see §13). |

---

## §2 Target Users

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 2.1 | Support undergraduate students and competitive-exam aspirants | ✅ | Auth (Firebase), user-isolated data, GATE exam track all present. |
| 2.2 | Users bring their own study material (PDF, notes) | ✅ | Upload flow accepts PDF/DOCX, parses chapters via `pdfplumber`/`python-docx`. |

---

## §3 User Problems (Enemies)

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 3.1 | **Enemy B:** Eliminate time wasted figuring out what to study | ⚠️ | Dashboard shows "Top 3 risk chapters" and a "next action" string, but risk chapters are computed only from quiz weakness counts — not from exam weightage. **Fix:** add an `exam_weight` field per chapter and use it in risk calculations in [compute_dashboard_summary()](file:///d:/ALP/ai-engine/main.py#244-303). |
| 3.2 | **Enemy C:** Bridge mismatch between learning and exam expectations | ⚠️ | Quiz prompt differentiates Foundation vs Application `gap_type`, but this is never surfaced to the user or used in adaptive logic. **Fix:** surface gap type on the feedback card in [QuizView.tsx](file:///d:/ALP/src/pages/QuizView.tsx); weight Application gaps higher in risk scoring. |
| 3.3 | **Enemy E:** Prevent false confidence from AI answers | ❌ | No validation pipeline exists; LLM output goes directly to quizzes. **Fix:** implement §12 validation pipeline. |

---

## §4 Philosophy & Principles

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 4.1 | Exam-weighted mastery over flat scoring | ❌ | Scoring is a simple correct-count percentage. **Fix:** add per-chapter exam weights; compute mastery as a weighted average across chapters. |
| 4.2 | Immediate feedback on mistakes | ✅ | [QuizView.tsx](file:///d:/ALP/src/pages/QuizView.tsx) shows explanation card immediately after each wrong answer. |
| 4.3 | Explainable, deterministic scoring | ⚠️ | Score is transparent (X/N) but not chapter-weighted. **Fix:** show per-chapter breakdown on result screen. |
| 4.4 | LLMs propose, system validates | ❌ | No verifier step. LLM output accepted verbatim. **Fix:** see §12. |
| 4.5 | Learn from errors, never from incorrect knowledge | ❌ | No error DB. **Fix:** see §13. |
| 4.6 | Reduce verbosity for competitive exams | ⚠️ | Prompt asks for concise explanations, but no max-length constraint. **Fix:** add token/character limit to the prompt and truncate on the frontend. |

---

## §5 Core Product Modes

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 5.1 | Mode A — Assignment Guidance | ❌ | Explicitly out-of-scope for MVP. No action needed. |
| 5.2 | Mode B — Competitive Exam (diagnostic quiz, mastery, remediation, reassessment) | ⚠️ | Diagnostic quiz works. Mastery tracking is rudimentary (global % only). Remediation code exists but unused. Reassessment loop not triggered. **Fix:** see §6 below. |

---

## §6 Core User Flow (9-step loop)

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 6.1 | User uploads syllabus-aligned study material | ✅ | [UploadPage.tsx](file:///d:/ALP/src/pages/UploadPage.tsx) → `/upload` endpoint. |
| 6.2 | System structures content into chapters & concepts | ✅ | `/documents/{doc_id}/parse` chunks by headings, extracts concepts. |
| 6.3 | User takes a diagnostic / chapter quiz | ⚠️ | Quiz generates from `raw.txt` (whole doc). Chapter-level quiz (`chapter_id` param) is supported in the backend but **never used by the frontend** — Dashboard always passes just the doc ID. **Fix:** let user pick a chapter before quiz; pass `chapter_id` to `/quiz/generate/{doc_id}?chapter_id=X`. |
| 6.4 | System provides immediate feedback on every wrong answer | ✅ | Feedback card with explanation shown instantly in [QuizView.tsx](file:///d:/ALP/src/pages/QuizView.tsx). |
| 6.5 | System diagnoses gaps (foundation vs application) | ⚠️ | `gap_type` is returned by the API but the **frontend ignores it**. **Fix:** display gap type badge (e.g., "Foundation Gap" / "Application Gap") on the feedback card. |
| 6.6 | Targeted learning / remediation provided | ❌ | [generate_remediation()](file:///d:/ALP/ai-engine/services/gemini.py#108-143) exists but is **dead code** — no route calls it. **Fix:** create a `GET /quiz/{quiz_id}/remediation` route; call it from a new remediation screen shown after quiz results. |
| 6.7 | Reassessment triggered | ❌ | No mechanism to trigger a follow-up quiz on weak areas. **Fix:** after remediation, offer a "Reassess" button that generates a quiz scoped to weak chapters only. |
| 6.8 | Mastery tracked until ≥80% per chapter | ⚠️ | 80% threshold is checked globally in [QuizView.tsx](file:///d:/ALP/src/pages/QuizView.tsx) (`isPassed = percentage >= 80`) but **not stored per-chapter**. **Fix:** persist per-chapter mastery in `documents.json` and update after each quiz submission. |
| 6.9 | Overall exam readiness via exam weightage | ❌ | Readiness is a heuristic (`12 + quiz_count * 5`). **Fix:** compute as weighted average of per-chapter mastery scores, using exam weights. |

---

## §7 Assessment & Feedback Rules

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 7.1 | Immediate feedback on incorrect answers | ✅ | Implemented. |
| 7.2 | Correct answer + concise explanation shown instantly | ✅ | Green highlight + explanation card. |
| 7.3 | Reduced verbosity | ⚠️ | No explicit length cap. **Fix:** add `"Keep explanation under 2 sentences."` to the Gemini prompt. |
| 7.4 | Gap exposure: max 3 bullet points, specific, exam-impact focused | ❌ | No structured gap-exposure view exists. Weaknesses are stored as strings but never shown to the user. **Fix:** add a "Gap Diagnosis" section to the quiz result screen, showing ≤3 diagnosed weaknesses. |
| 7.5 | Chapter pass ≥80% | ⚠️ | Checked globally, not per-chapter. **Fix:** track per-chapter. |
| 7.6 | Overall readiness weighted by exam importance | ❌ | See 6.9 above. |

---

## §8 Learning Memory & Personalization

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 8.1 | Remember user exam preference | ✅ | Stored in [SettingsPage](file:///d:/ALP/src/pages/SettingsPage.tsx#21-250) via `localStorage` (`alp_target_date`, `alp_target_score`). |
| 8.2 | Remember per-chapter mastery score | ❌ | Not tracked anywhere. **Fix:** add `mastery_score` field to each chapter in `documents.json`. |
| 8.3 | Remember learning trend (last 3 attempts) | ⚠️ | `trend` exists in dashboard summary but is synthetically derived (`[readiness-10, readiness-5, readiness]`), not from real quiz history. **Fix:** store quiz timestamps and scores; compute real trend from last 3 quiz results. |
| 8.4 | Remember mistake types | ⚠️ | `weaknesses` array in quiz records captures `gap_type` labels and is now aggregated into the "Critical Weaknesses" dashboard card, but this is coarse (e.g., "Foundation"/"Application" only) and not tracked per chapter or over time. **Fix:** store richer mistake metadata and surface per-chapter/type trends. |
| 8.5 | Do NOT remember emotional/personality profiling or cross-user content | ✅ | No such data is collected. User data is isolated by `user_id`. |

---

## §9 Dashboard (Single-Screen MVP)

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 9.1 | Show: "Where do I stand overall?" (Exam readiness %) | ⚠️ | Readiness gauge exists but value is a heuristic, not weighted mastery. **Fix:** see 6.9. |
| 9.2 | Show: "Where am I weak?" (Top 3 risk chapters) | ⚠️ | Risk chapters shown, but computed from weakness-string counts, not per-chapter mastery. **Fix:** derive from actual per-chapter scores. |
| 9.3 | Show: "What should I do next?" (Directive action) | ✅ | `nextAction` string is context-aware (no docs → upload; no quizzes → start; low readiness → remediate; high → expand). |
| 9.4 | Dashboard style is directive (not informational) | ✅ | Single CTA button drives the user to the exact next step. Excellent UX. |

---

## §10 Knowledge & Data Architecture

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 10A | User Content Layer — documents stored per-user | ✅ | PDF/DOCX stored in `data/uploads/`, metadata in `documents.json` with `user_id`. |
| 10B | Vector DB (RAG) — chunked, embedded, metadata-tagged | ✅ | Parse pipeline now embeds each chunk via `GeminiService.generate_embeddings()` (FastEmbed BGE model) and upserts to Qdrant with per-doc/user/chapter metadata. Retrieval for quiz generation is still missing (see 14.3). |
| 10C | Master Q&A Datastore — validated-only content | ❌ | Does not exist. `quizzes.json` stores raw LLM output. **Fix:** add `master_qa.json` or a DB table; only promote questions that pass validation. |
| 10D | Error/Experience DB — logs hallucinations & deviations | ❌ | No logging. **Fix:** add `error_log.json`; log validation failures, flagged questions. |

---

## §11 LLM Usage Policy

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 11.1 | LLM generates candidate questions | ✅ | `GeminiService.generate_quiz()`. |
| 11.2 | LLM generates candidate answers | ✅ | Answers included in generation. |
| 11.3 | LLM explains concepts concisely | ✅ | Explanation field in quiz response. |
| 11.4 | LLM acts as verifier (secondary LLM) | ❌ | No verifier. **Fix:** add a second LLM call (or same model, different prompt) to cross-check generated Q&A before serving. |
| 11.5 | LLM cannot assert truth / write to Master DB / decide mastery | ⚠️ | LLM output goes directly to `quizzes.json` (which is used for scoring). No gatekeeper. **Fix:** insert validation pipeline between generation and storage. |

---

## §12 Validation Pipeline (Hybrid)

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 12.1 | Rule-based checks on LLM output | ⚠️ | Only structural validation exists (required keys check in [quiz.py](file:///d:/ALP/ai-engine/routers/quiz.py)). No semantic rules. **Fix:** add checks: e.g., correct_index within range, options are distinct, question is non-trivial, explanation references the source text. |
| 12.2 | Verifier LLM validation | ❌ | **Fix:** add a second Gemini call — prompt a verifier to confirm the answer is correct given the source text. |
| 12.3 | Human-in-the-loop approval (sampling or mandatory in MVP) | ❌ | **Fix (MVP):** add a `/quiz/{quiz_id}/flag` endpoint; let users flag wrong questions; log flags in `error_log.json`. Admin review can be manual initially. |

---

## §13 Error Learning Without Knowledge Pollution

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 13.1 | Log hallucinations, off-topic outputs, incorrect answers | ❌ | **Fix:** create `data/error_log.json`. Log all flagged questions, verifier rejections, and parse failures. |
| 13.2 | Categorize error types | ❌ | **Fix:** add fields: `error_type` (hallucination, off-topic, factual_error), `model_used`, `prompt_hash`. |
| 13.3 | Improve prompts & rules from errors, never use errors as content | ❌ | **Fix:** periodically review logs; update prompt templates and rule-based checks. Mark errors as `used_for_training: false`. |

---

## §14 Technology Stack

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 14.1 | Frontend: React | ✅ | React 19 + Vite. |
| 14.2 | Backend: FastAPI / Node.js | ✅ | FastAPI (AI engine, port 8000) + Express (Node server, port 3001). |
| 14.3 | Vector DB: Qdrant | ⚠️ | Qdrant client is connected and chunks are embedded+upserted on parse, but **no retrieval or RAG query is used** when generating quizzes yet. **Fix:** add a search step that pulls top-N relevant chunks for quiz generation. |
| 14.4 | Relational DB: PostgreSQL | ❌ | All data is in flat JSON files (`documents.json`, `quizzes.json`). **Fix (MVP-acceptable):** JSON files work for MVP; plan migration for post-MVP. |
| 14.5 | LLMs: Gemini (GPT-class) + verifier | ⚠️ | Gemini used for generation. No verifier. **Fix:** add verifier call. |
| 14.6 | Embeddings | ✅ | Implemented via local FastEmbed `BAAI/bge-base-en-v1.5` in `GeminiService.generate_embeddings()`, used to vectorize parsed chunks before upserting to Qdrant. |

---

## §15 Non-Goals (should NOT be present)

| # | One-Liner | Status | Notes |
|---|-----------|--------|-------|
| 15.1 | No full LMS | ✅ | Correct — no course management. |
| 15.2 | No content marketplace | ✅ | Correct. |
| 15.3 | No teacher replacement | ✅ | Correct. |
| 15.4 | No black-box ML decisions | ⚠️ | Readiness formula is a heuristic (`12 + count*5`) which is technically not black-box but is arbitrary and unexplained to the user. |
| 15.5 | No custom ML model training | ✅ | Correct. |

---

## §16 Success Metrics (MVP)

| # | One-Liner | Status | Notes / Recommendation |
|---|-----------|--------|------------------------|
| 16.1 | % users identifying clear weak areas | ⚠️ | Weaknesses tracked but **not surfaced to user clearly**. **Fix:** show gap diagnosis after quiz and on dashboard. |
| 16.2 | Improvement between first and second quiz | ❌ | No multi-attempt tracking per chapter. **Fix:** persist quiz history per chapter; show delta on dashboard. |
| 16.3 | Reduction in repeated mistake types | ❌ | Mistake types stored but never compared across attempts. **Fix:** compare `weaknesses` arrays across quiz sessions for the same chapter. |
| 16.4 | User trust feedback (perceived correctness) | ❌ | No feedback mechanism. **Fix:** add a "Was this explanation helpful? 👍/👎" button on the feedback card. |

---

## §17 MVP Scope Constraints

| # | One-Liner | Status | Notes |
|---|-----------|--------|-------|
| 17.1 | One exam only | ✅ | GATE hardcoded throughout. |
| 17.2 | Limited subjects & chapters | ✅ | Subject dropdown has 3 options. |
| 17.3 | Manual/sampling validation allowed | ❌ | No validation mechanism at all — needs at least a flag/report button. |
| 17.4 | Focus on closed-loop learning proof | ⚠️ | The loop is **open**: Quiz → Score → Dashboard. No remediation → reassessment occurs. **Fix:** this is the single most critical gap. Close the loop. |

---

## §18 Long-Term Extensions — correctly excluded

All items (IRT, multi-exam, predictive scoring, institutional dashboards) are correctly absent. ✅

---

## §19 Final Product Guarantee

> *"Grounded, exam-aligned learning; avoid false confidence via assessment → feedback → reassessment loops."*

| Aspect | Status | Verdict |
|--------|--------|---------|
| Assessment | ✅ | Quiz works |
| Feedback | ✅ | Immediate explanation |
| Reassessment | ❌ | **Missing — the loop is open** |
| Grounding enforcement | ❌ | No validation pipeline |

---

## Priority Summary

### 🔴 Critical (Loop is open — defeats core product promise)

1. **Close the mastery loop**: Remediation → Reassessment → Per-chapter mastery tracking ≥80%
2. **Wire up [generate_remediation()](file:///d:/ALP/ai-engine/services/gemini.py#108-143)** to a route and frontend screen
3. **Compute real readiness** from weighted per-chapter mastery, not heuristic
4. **Surface gap diagnosis** (`gap_type` + weakness list) to the user

### 🟡 Important (PRD policy violations)

5. Add **validation pipeline** (rule-based + verifier LLM) before questions enter the quiz
6. Add **error logging** (hallucinations, flagged questions)
7. **Activate Qdrant**: embed chunks, use RAG for quiz generation
8. Track **quiz history** per chapter for trend and improvement metrics
9. Support **chapter-level quizzes** on the frontend (backend already supports it)

### 🟢 Nice-to-have (polish to PRD standard)

10. Add user feedback (👍/👎) on explanations
11. Enforce verbosity limits in LLM prompts
12. Show per-chapter mastery breakdown on result screen
13. Plan **PostgreSQL migration** for post-MVP
