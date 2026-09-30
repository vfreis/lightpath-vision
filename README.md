# LightPath Vision — AI Vision Quality Control

Production-oriented computer vision and multimodal AI system built to analyze product images, compare observable visual evidence against approved references, and return structured results with explicit uncertainty handling.

> **Portfolio note:** this repository contains the engineering implementation. The public case study intentionally omits client-specific business data, proprietary evaluation policies, internal thresholds, prompts, datasets, and other sensitive implementation details.

## What this project demonstrates

- Multimodal AI integrated into a real application workflow
- Server-side image preprocessing and validation
- Structured, machine-readable AI outputs
- Reference-based visual comparison
- Explicit `success`, `inconclusive`, and `error` states
- Deterministic server-side guardrails around AI reasoning
- Frontend-to-backend API integration
- Production-minded failure handling without synthetic success fallbacks

## Architecture

```text
Image Input
   ↓
Safe Image Processing
   ↓
Multimodal AI Analysis
   ↓
Reference Comparison
   ↓
Server-Side Validation & Guardrails
   ↓
Structured Result
```

The AI layer performs visual reasoning. Critical business rules, catalog integrity, validation, permissions, and application state remain controlled by deterministic software.

## Repository structure

- `frontend/` — React + Vite + TypeScript interface for image capture/upload, preview, analysis, and result rendering
- `api/` — Node.js + TypeScript backend for image handling, multimodal inference, structured outputs, and validation
- `data/` — versioned product/reference data used by the implementation
- `docs/API_CONTRACT.md` — API contract
- `docs/QA_GO_NO_GO.md` — QA and release criteria
- `docs/PORTFOLIO_CASE_STUDY.md` — sanitized engineering case study for clients and recruiters

## Reliability principles

### Explicit uncertainty

The system is allowed to return `inconclusive` when visual evidence is insufficient. Uncertainty is treated as a valid system outcome rather than forcing a classification.

### No fake fallback

Network failures, provider errors, invalid responses, or configuration failures remain real errors. The application does not fabricate a successful recognition result to preserve the demo experience.

### Server-side control

Secrets remain server-side. Model output is validated before it becomes application state, and authoritative product/reference information is controlled by the software layer.

### Structured outputs

AI responses are constrained into predictable application contracts so downstream UI and services can consume them safely.

## Technology

- TypeScript
- Node.js
- React
- Vite
- REST APIs
- Multimodal AI
- Structured Outputs
- Server-side image processing
- Production-oriented validation and guardrails

## Portfolio case study

For a client-safe overview of the problem, solution, engineering decisions, and demonstrated capabilities, see:

**[AI Vision Quality Control — Portfolio Case Study](docs/PORTFOLIO_CASE_STUDY.md)**

## Local development

```bash
npm install
npm --workspace @lightpath/braciera-vision-api run build
OPENAI_API_KEY=... npm --workspace @lightpath/braciera-vision-api start
VITE_API_BASE_URL=http://localhost:8787 npm --workspace frontend run dev
```

## Disclosure

This repository is shared as engineering evidence. Client-sensitive details and proprietary evaluation logic are intentionally not documented in the public portfolio narrative.
