# FineLens

Transparent German legal assistant powered by [Graphiti](https://github.com/getzep/graphiti) knowledge graphs.

Ask legal questions in German, get answers with **source citations** traced back to Graphiti episodes, and receive **prefilled legal forms** based on your profile.

## Features

- **Graphiti Knowledge Graph** — Ingests laws from Open Legal Data, Gesetze im Internet, and recht.bund.de
- **Transparent Answers** — Every response shows citations with law references and source URLs
- **Interactive Forms** — Mietwiderspruch, Kündigungswiderspruch, DSGVO-Auskunft, Arbeitszeugnis — prefilled from user profile
- **Profile Wizard** — 3-step onboarding collects data used across forms and chat context
- **Source Dashboard** — Overview of all integrated legal data sources

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Next.js UI     │────▶│  FastAPI Backend │────▶│  Graphiti   │
│  (FineLens)     │     │  /chat /forms    │     │  + FalkorDB │
└─────────────────┘     └────────┬─────────┘     └─────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
                    Open Legal   Gesetze im    recht.bund.de
                       Data       Internet      + buzer.de
                                 + beck/juris (Referenz)
```

## Quick Start

### 1. Graph database

**Option A — Embedded (default, no Docker):** Set `GRAPH_BACKEND=embedded` in `.env`. Uses FalkorDB Lite locally at `backend/data/graphiti.db`.

**Option B — Docker FalkorDB:** If you have Redis on port 6379, FalkorDB is mapped to **6380** to avoid conflicts:

```bash
docker compose up -d
# Then set GRAPH_BACKEND=falkordb and FALKORDB_PORT=6380 in .env
```

### 2. Configure environment

```bash
cp .env.example .env
# Add your OPENAI_API_KEY
```

### 3. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

### 4. Seed demo legal data

```bash
# Via API
curl -X POST http://localhost:8000/ingest/seed

# Or via script
python scripts/seed.py
```

### 5. Start the frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Legal Data Sources

| Source | URL | Integration |
|--------|-----|-------------|
| Open Legal Data | de.openlegaldata.io | REST API ingestion |
| Gesetze im Internet | gesetze-im-internet.de | XML TOC + HTML fetch |
| recht.bund.de | rechtsinformationen.bund.de | REST API |
| buzer.de | buzer.de | HTML scraping (§-level) |
| beck-online | beck-online.beck.de | Reference index (license required) |
| juris | juris.de | Reference index (license required) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Ask a legal question |
| GET/PUT | `/users/{id}` | User profile |
| GET | `/forms` | List prefilled forms |
| POST | `/ingest` | Ingest from a source |
| POST | `/ingest/seed` | Seed demo data |
| GET | `/health` | System status |

## Disclaimer

FineLens provides legal **information**, not legal **advice**. Always consult a qualified attorney for binding guidance.
